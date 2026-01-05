import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { loadSettingsServer } from '@/app/lib/storage/settingsStorageServer';
import { extractSpreadsheetId } from '@/app/lib/utils/googleSheetsUtils';

// Fallback values (for backward compatibility)
const DEFAULT_SPREADSHEET_ID = '1q8oKeu3fI5BuMpkJXhAtlJQsfAXjLHawkfq9yrI5gck';
const DEFAULT_SHEET_NAME = 'Main_Simulation';

export async function GET() {
  try {
    // Load settings from Supabase
    const settings = await loadSettingsServer();
    
    // Extract spreadsheet ID from URL or use provided value
    let spreadsheetId: string;
    if (settings?.googleSheetsUrl) {
      const extractedId = extractSpreadsheetId(settings.googleSheetsUrl);
      if (!extractedId) {
        return NextResponse.json(
          { error: 'Invalid Google Sheets URL format. Please provide a valid URL or spreadsheet ID.' },
          { status: 400 }
        );
      }
      spreadsheetId = extractedId;
    } else {
      spreadsheetId = DEFAULT_SPREADSHEET_ID;
    }
    
    const sheetName = settings?.googleSheetName || DEFAULT_SHEET_NAME;

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        project_id: process.env.GOOGLE_PROJECT_ID,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Get the sheet ID for the specific tab
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    let sheetId: number | undefined;
    for (const sheet of spreadsheet.data.sheets || []) {
      if (sheet.properties?.title === sheetName) {
        sheetId = sheet.properties.sheetId ?? undefined;
        break;
      }
    }

    if (sheetId === undefined) {
      return NextResponse.json(
        { error: `Sheet "${sheetName}" not found` },
        { status: 404 }
      );
    }

    // Find header row (row 2 based on image description)
    // The headers are: Job Number (E), Order Type (H), Current Bucket (I), and we need to find Machine ID column
    // Let's read the header row first to identify column indices
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!D2:I2`,
    });

    const headers = (headerResponse.data.values || [])[0] || [];
    
    // Read the data from the sheet (starting from row 3, since row 2 has headers)
    // Read columns D through I to match the header range
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!D3:I10000`, // Data starts from row 3, columns D-I
    });

    const rows = response.data.values || [];
    
    if (rows.length === 0) {
      return NextResponse.json({ data: [] });
    }
    
    // Find column indices (0-indexed within D2:I2 range)
    // Since we're reading D2:I2, the indices are: D=0, E=1, F=2, G=3, H=4, I=5
    // But actual columns in sheet: Job Number=E(1), Job Part=F(2), Order Type=H(4), Current Bucket=I(5)
    let jobNumberIndex = headers.findIndex((h: string) => 
      h?.toLowerCase().includes('job number') && !h?.toLowerCase().includes('parent')
    );
    let jobPartIndex = headers.findIndex((h: string) => 
      h?.toLowerCase().includes('job part')
    );
    let orderTypeIndex = headers.findIndex((h: string) => 
      h?.toLowerCase().includes('order type')
    );
    let currentBucketIndex = headers.findIndex((h: string) => 
      h?.toLowerCase().includes('current bucket')
    );
    
    // Fallback to direct indices if header search fails
    // Within D2:I2 range: E=index 1, F=index 2, H=index 4, I=index 5
    if (jobNumberIndex === -1 && headers.length > 1) jobNumberIndex = 1; // Column E in D-I range
    if (jobPartIndex === -1 && headers.length > 2) jobPartIndex = 2; // Column F in D-I range
    if (orderTypeIndex === -1 && headers.length > 4) orderTypeIndex = 4; // Column H in D-I range
    if (currentBucketIndex === -1 && headers.length > 5) currentBucketIndex = 5; // Column I in D-I range
    
    const data = rows.map((row) => {
      const jobNumber = row[jobNumberIndex]?.trim() || '';
      const jobPart = row[jobPartIndex]?.trim() || '';
      const orderType = row[orderTypeIndex]?.trim() || '';
      const currentBucket = row[currentBucketIndex]?.trim() || '';
      
      return {
        jobNumber, // This is the machine ID to show in comments
        jobPart,   // Used to map to platform via PART_NUMBER_TO_PLATFORM
        orderType,
        currentBucket,
        // Include full row for debugging
        fullRow: row,
      };
    }).filter((item) => 
      item.jobNumber && 
      item.jobPart &&
      item.orderType?.toLowerCase() === 'forecast' &&
      item.currentBucket
    );

    return NextResponse.json({ data, headers });
  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from Google Sheets' },
      { status: 500 }
    );
  }
}

