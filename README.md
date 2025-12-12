## MVS-T Demand Waterfall

A web application built to visualize the demand waterfall with sales order and forecast data for MVS-T OF department. Track order changes, forecast accuracy, and analyze demand patterns over time.

### Tech Stack

- **Next.js** (framework)
- **Supabase** (database)
- **Handsontable** (tables library)
- **Recharts** (charting library)

## Features

#### 1. Demand Waterfall View

#### 2. Forecast Accuracy Dashboard

A dedicated page for analyzing forecast performance and order changes over time.

1. **Changes Tracking**
   - **Shipped**: shipped machine
   - **Delayed**: orders moved to later months
   - **New Forecast**: new forecast load ins
   - **Forecast → SO**: forecast conversions to sales orders

2. **Forecast Accuracy Metrics**
   - Calculate forecast accuracy percentage: `(Forecast Conversions) / (Forecast Conversions + Forecast Load Ins) × 100`


## Usage
1. Upload the SO & Forecast files by clicking the upload button
2. The files must be .csv file
3. In editing mode:
   - **Left click** on a date to change the forecast load-in date
   - **Right click** to delete that period's records
4. Use checkboxes to filter by platforms
5. Click the refresh button if you don't see latest changes
