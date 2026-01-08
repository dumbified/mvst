import { getSupabase, getSupabaseServiceRole } from "./supabaseClientServer";
import { SharedWaterfallState } from "./stateStorage";
import { loadJsonFromStorage } from "./supabaseStorageServer";

type StorageError = { 
  message?: string; 
  statusCode?: string | number;
  status?: string | number;
};

const STATE_BUCKET = process.env.NEXT_PUBLIC_WATERFALL_STATE_BUCKET ?? "uploads";
const STATE_PATH = "shared/waterfall-state.json";

const BACKUP_FOLDER = "backups";
const BACKUP_RETENTION_WEEKS = 8; // Keep backups for 8 weeks (2 months)

const UPLOAD_FOLDERS = ["sales-orders", "forecasts"];

/**
 * Format date for backup filename: YYYY-MM-DD_HH-MM-SS
 */
function formatBackupDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

/**
 * Load state from storage (server-side version for backups)
 */
async function loadStateForBackup(): Promise<SharedWaterfallState | null> {
  return loadJsonFromStorage<SharedWaterfallState>(STATE_BUCKET, STATE_PATH);
}

/**
 * Create a backup of the current waterfall state
 */
export async function createBackup(): Promise<{ success: boolean; backupPath?: string; error?: string }> {
  try {
    // Load current state (server-side)
    const currentState = await loadStateForBackup();
    
    if (!currentState) {
      return {
        success: false,
        error: "No state found to backup",
      };
    }

    // Create backup filename with timestamp
    const timestamp = formatBackupDate(new Date());
    const backupFileName = `waterfall-state-backup_${timestamp}.json`;
    const backupPath = `${BACKUP_FOLDER}/${backupFileName}`;

    // Upload backup to Supabase storage
    // Try service role client first (bypasses RLS), fallback to anon client
    const supabaseService = getSupabaseServiceRole();
    const supabase = supabaseService || getSupabase();
    const isUsingServiceRole = !!supabaseService;
    
    // Use Buffer for server-side instead of Blob (Blob may not work in Node.js)
    const jsonString = JSON.stringify(currentState, null, 2);
    const buffer = Buffer.from(jsonString, 'utf-8');
    
    const { error } = await supabase.storage
      .from(STATE_BUCKET)
      .upload(backupPath, buffer, { 
        upsert: false, // Don't overwrite existing backups
        contentType: "application/json" 
      });

    if (error) {
      // If file already exists, that's okay - we use timestamp so collisions are rare
      if (error.message?.includes("already exists") || error.message?.includes("duplicate")) {
        return {
          success: true,
          backupPath,
        };
      }
      
      // Handle RLS policy violations - provide helpful error message
      const storageError = error as StorageError;
      const errorStatus = storageError.statusCode || storageError.status;
      const isRlsError = 
        errorStatus === '403' || 
        errorStatus === 403 ||
        error.message?.toLowerCase().includes("row-level security") || 
        error.message?.toLowerCase().includes("rls") ||
        error.message?.toLowerCase().includes("policy") ||
        error.message?.toLowerCase().includes("permission denied");
      
      if (isRlsError) {
        const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
        let solution: string;
        
        if (isUsingServiceRole && hasServiceRoleKey) {
          solution = `Service role key is configured and being used, but still getting RLS error. This suggests:
1. The service role key might be incorrect - verify it in Supabase Dashboard > Settings > API
2. The bucket may have bucket-level policies that restrict access
3. Check Supabase Dashboard > Storage > Policies for the "${STATE_BUCKET}" bucket
4. Ensure the service role key has the correct format (starts with "eyJ...")`;
        } else if (hasServiceRoleKey && !isUsingServiceRole) {
          solution = `Service role key is set in environment but not being used. Check if SUPABASE_SERVICE_ROLE_KEY is correctly loaded.`;
        } else {
          solution = `Set SUPABASE_SERVICE_ROLE_KEY in .env.local to bypass RLS for server-side backups.
Alternatively, update RLS policies in Supabase Dashboard > Storage > Policies to allow uploads to the '${BACKUP_FOLDER}' folder.`;
        }
        
        console.error(`[Backup] RLS Error: ${error.message}`);
        console.error(`[Backup] Using service role: ${isUsingServiceRole}, Has key: ${hasServiceRoleKey}`);
        
        return {
          success: false,
          error: `Permission denied (RLS): ${error.message}\n\n${solution}`,
        };
      }
      
      // Log other errors for debugging
      console.error(`[Backup] Upload error:`, {
        message: error.message,
        statusCode: errorStatus,
      });
      
      throw error;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Backup] Successfully created backup: ${backupPath}`);
    }

    return {
      success: true,
      backupPath,
    };
  } catch (error) {
    console.error("[Backup] Backup failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * List all backup files (internal use only)
 */
async function listBackups(): Promise<string[]> {
  try {
    // Try service role client first (bypasses RLS), fallback to anon client
    const supabaseService = getSupabaseServiceRole();
    const supabase = supabaseService || getSupabase();
    
    const { data, error } = await supabase.storage
      .from(STATE_BUCKET)
      .list(BACKUP_FOLDER, {
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      // If folder doesn't exist yet, that's okay - return empty array
      const storageError = error as StorageError;
      const errorStatus = storageError.statusCode || storageError.status;
      if (error.message?.includes("not found") || errorStatus === '404' || errorStatus === 404) {
        return [];
      }
      console.error("[Backup] Failed to list backups:", error);
      return [];
    }

    return (data || [])
      .filter((file) => file.name.startsWith("waterfall-state-backup_") && file.name.endsWith(".json"))
      .map((file) => file.name);
  } catch (error) {
    console.error("[Backup] Failed to list backups:", error);
    return [];
  }
}

/**
 * Delete old backups, keeping only the most recent N weeks
 */
export async function cleanupOldBackups(): Promise<{ deleted: number; error?: string }> {
  try {
    const backups = await listBackups();
    if (backups.length === 0) {
      return { deleted: 0 };
    }

    // Parse dates from backup filenames
    const backupsWithDates = backups
      .map((name) => {
        // Extract date from filename: waterfall-state-backup_YYYY-MM-DD_HH-MM-SS.json
        const match = name.match(/waterfall-state-backup_(\d{4}-\d{2}-\d{2})_/);
        if (!match) return null;
        
        const dateStr = match[1];
        const date = new Date(dateStr + "T00:00:00");
        
        return { name, date };
      })
      .filter((item): item is { name: string; date: Date } => item !== null)
      .sort((a, b) => b.date.getTime() - a.date.getTime()); // Newest first

    // Calculate cutoff date (N weeks ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (BACKUP_RETENTION_WEEKS * 7));

    // Find backups to delete
    const backupsToDelete = backupsWithDates.filter(
      (backup) => backup.date < cutoffDate
    );

    if (backupsToDelete.length === 0) {
      return { deleted: 0 };
    }

    // Delete old backups
    // Try service role client first (bypasses RLS), fallback to anon client
    const supabaseService = getSupabaseServiceRole();
    const supabase = supabaseService || getSupabase();
    const pathsToDelete = backupsToDelete.map(
      (backup) => `${BACKUP_FOLDER}/${backup.name}`
    );

    const { error } = await supabase.storage
      .from(STATE_BUCKET)
      .remove(pathsToDelete);

    if (error) {
      // Log error but don't fail completely - cleanup is non-critical
      console.error(`[Backup] Failed to delete old backups:`, error);
      return {
        deleted: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    if (process.env.NODE_ENV === 'development' && backupsToDelete.length > 0) {
      console.log(`[Backup] Deleted ${backupsToDelete.length} old backup(s)`);
    }

    return { deleted: backupsToDelete.length };
  } catch (error) {
    console.error("Failed to cleanup old backups:", error);
    return {
      deleted: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Restore state from a backup file
 */
export async function restoreFromBackup(backupFileName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const backupPath = `${BACKUP_FOLDER}/${backupFileName}`;
    
    // Load backup file
    const backupState = await loadJsonFromStorage<SharedWaterfallState>(STATE_BUCKET, backupPath);
    
    if (!backupState) {
      return {
        success: false,
        error: `Backup file not found: ${backupFileName}`,
      };
    }

    // Restore to main state file
    const supabaseService = getSupabaseServiceRole();
    const supabase = supabaseService || getSupabase();
    
    // Use Buffer for server-side instead of Blob
    const jsonString = JSON.stringify(backupState, null, 2);
    const buffer = Buffer.from(jsonString, 'utf-8');
    
    const { error } = await supabase.storage
      .from(STATE_BUCKET)
      .upload(STATE_PATH, buffer, {
        upsert: true,
        contentType: "application/json"
      });

    if (error) {
      console.error(`[Backup] Restore error:`, error);
      return {
        success: false,
        error: error.message || "Failed to restore backup",
      };
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Backup] Successfully restored from backup: ${backupFileName}`);
    }

    return { success: true };
  } catch (error) {
    console.error("[Backup] Restore failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Cleanup old upload files (sales orders and forecasts) from Supabase storage
 * Files are named with timestamp prefix: TIMESTAMP-filename.csv
 */
export async function cleanupOldUploads(): Promise<{ deleted: number; error?: string }> {
  try {
    const supabaseService = getSupabaseServiceRole();
    const supabase = supabaseService || getSupabase();
    
    let totalDeleted = 0;

    // Process each upload folder
    for (const folder of UPLOAD_FOLDERS) {
      try {
        const { data, error } = await supabase.storage
          .from(STATE_BUCKET)
          .list(folder, {
            sortBy: { column: "created_at", order: "desc" },
          });

        if (error) {
          // If folder doesn't exist yet, that's okay - skip it
          const storageError = error as StorageError;
          const errorStatus = storageError.statusCode || storageError.status;
          if (error.message?.includes("not found") || errorStatus === '404' || errorStatus === 404) {
            continue;
          }
          console.error(`[Backup] Failed to list files in ${folder}:`, error);
          continue;
        }

        if (!data || data.length === 0) {
          continue;
        }

        // Delete ALL files in the folder (no retention kept)
        const filesToDelete = data.map((file) => `${folder}/${file.name}`);

        if (filesToDelete.length === 0) {
          continue;
        }

        // Delete old files
        const { error: deleteError } = await supabase.storage
          .from(STATE_BUCKET)
          .remove(filesToDelete);

        if (deleteError) {
          console.error(`[Backup] Failed to delete old files from ${folder}:`, deleteError);
          continue;
        }

        totalDeleted += filesToDelete.length;
        
        if (process.env.NODE_ENV === 'development' && filesToDelete.length > 0) {
          console.log(`[Backup] Deleted ${filesToDelete.length} old file(s) from ${folder}`);
        }
      } catch (error) {
        console.error(`[Backup] Error processing folder ${folder}:`, error);
        // Continue with other folders even if one fails
      }
    }

    return { deleted: totalDeleted };
  } catch (error) {
    console.error("[Backup] Failed to cleanup old uploads:", error);
    return {
      deleted: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

