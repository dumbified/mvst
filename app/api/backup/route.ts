import { NextRequest, NextResponse } from "next/server";
import { createBackup, cleanupOldBackups } from "../../lib/backup";

/**
 * API route for creating backups
 * This can be called by:
 * 1. Cron jobs (Vercel Cron, external cron services)
 * 2. Manual triggers
 * 
 * To secure this endpoint, you can add authentication:
 * - API key in headers
 * - Environment variable check
 * - etc.
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization here
    // Example: Check for API key in headers
    const authHeader = request.headers.get("authorization");
    const expectedKey = process.env.BACKUP_API_KEY;
    
    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Create backup
    const backupResult = await createBackup();
    
    if (!backupResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: backupResult.error || "Backup failed" 
        },
        { status: 500 }
      );
    }

    // Cleanup old backups (non-blocking)
    cleanupOldBackups().catch((error) => {
      console.error("Cleanup failed (non-critical):", error);
    });

    return NextResponse.json({
      success: true,
      backupPath: backupResult.backupPath,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Backup API error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check backup status (optional)
 */
export async function GET() {
  return NextResponse.json({
    message: "Backup API is running",
    endpoint: "/api/backup",
    method: "POST",
  });
}

