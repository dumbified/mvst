/**
 * Extracts the spreadsheet ID from a Google Sheets URL
 * Supports various URL formats:
 * - https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
 * - https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
 * - https://docs.google.com/spreadsheets/d/SPREADSHEET_ID
 * - SPREADSHEET_ID (if just the ID is provided)
 */
export function extractSpreadsheetId(url: string): string | null {
  if (!url || !url.trim()) {
    return null;
  }

  const trimmed = url.trim();

  // If it's already just an ID (alphanumeric string), return it
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }

  // Try to extract from URL
  // Pattern: /spreadsheets/d/([a-zA-Z0-9_-]+)
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

