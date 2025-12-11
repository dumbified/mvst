import { getSupabase } from "./supabaseClient";
import { SharedWaterfallState } from "./stateStorage";

const STATE_BUCKET = process.env.NEXT_PUBLIC_WATERFALL_STATE_BUCKET ?? "uploads";
const STATE_PATH = "shared/waterfall-state.json";

const BACKUP_FOLDER = "backups";
const BACKUP_RETENTION_WEEKS = 8; // Keep backups for 8 weeks (2 months)

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
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(STATE_BUCKET).download(STATE_PATH);
    
    if (error || !data) {
      return null;
    }
    
    const text = await data.text();
    return JSON.parse(text) as SharedWaterfallState;
  } catch {
    return null;
  }
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
    const supabase = getSupabase();
    const blob = new Blob([JSON.stringify(currentState, null, 2)], { 
      type: "application/json" 
    });
    
    const { error } = await supabase.storage
      .from(STATE_BUCKET)
      .upload(backupPath, blob, { 
        upsert: false, // Don't overwrite existing backups
        contentType: "application/json" 
      });

    if (error) {
      // If file already exists, that's okay - we use timestamp so collisions are rare
      if (error.message?.includes("already exists")) {
        return {
          success: true,
          backupPath,
        };
      }
      throw error;
    }

    return {
      success: true,
      backupPath,
    };
  } catch (error) {
    console.error("Backup failed:", error);
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
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(STATE_BUCKET)
      .list(BACKUP_FOLDER, {
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      console.error("Failed to list backups:", error);
      return [];
    }

    return (data || [])
      .filter((file) => file.name.startsWith("waterfall-state-backup_") && file.name.endsWith(".json"))
      .map((file) => file.name);
  } catch (error) {
    console.error("Failed to list backups:", error);
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
    const supabase = getSupabase();
    const pathsToDelete = backupsToDelete.map(
      (backup) => `${BACKUP_FOLDER}/${backup.name}`
    );

    const { error } = await supabase.storage
      .from(STATE_BUCKET)
      .remove(pathsToDelete);

    if (error) {
      throw error;
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


