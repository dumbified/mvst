 'use client';
 
 import React, { useMemo } from "react";
 import { HotTable } from "@handsontable/react-wrapper";
 import 'handsontable/styles/handsontable.min.css';
 import 'handsontable/styles/ht-theme-main.min.css';
 import Handsontable from 'handsontable/base';
 import { registerAllModules } from 'handsontable/registry';
 
 registerAllModules();
 
 export default function DemandWaterfallTable() {
   const months = [
     "Mar 25",
     "Apr 25",
     "May 25",
     "Jun 25",
     "Jul 25",
     "Aug 25",
     "Sep 25",
     "Oct 25",
     "Nov 25",
     "Dec 25",
     "Jan 26",
     "Feb 26",
   ];
 
   const dates = [
     "24 Mar 2025",
     "31 Mar 2025",
     "7 Apr 2025",
     "14 Apr 2025",
   ];
 
   const platforms = ["TH3K", "TR3K", "TRS+", "THSE"];
 
   // Build table data: 4 platforms per date
   const data = useMemo(() => {
     const rows: (string | number)[][] = [];
     dates.forEach((d, di) => {
       platforms.forEach((p) => {
         const row: (string | number)[] = [];
         row.push(d); // Fcast Load in Date
         row.push(p); // Platform
         months.forEach((_, mi) => {
           row.push(mi === 1 && di === 2 && p === "TR3K" ? 5 : ""); // SO
           row.push(mi === 2 && di === 0 && p === "TRS+" ? 10 : ""); // Forecast
           row.push(mi === 0 && di === 3 && p === "THSE" ? 1 : ""); // SS
         });
         rows.push(row);
       });
     });
     return rows;
   }, [months, dates, platforms]);
 
   // Nested headers: months on top, SO/Forecast/SS below
   const nestedHeaders = useMemo(() => {
     const topRow: any[] = [
       { label: "Fcast Load in Date", colspan: 1 },
       { label: "Platform", colspan: 1 },
       ...months.map((m) => ({ label: m, colspan: 3 })),
     ];
     const secondRow: any[] = [
       "Fcast Load in Date",
       "Platform",
       ...months.flatMap(() => ["SO", "Forecast", "SS"]),
     ];
     return [topRow, secondRow];
   }, [months]);
 
   // Column widths: [date, platform, (SO, Forecast, SS) * months]
   const colWidths = useMemo(() => {
     const widths: number[] = [180, 120];
     months.forEach(() => widths.push(64, 88, 64));
     return widths;
   }, [months]);
 
   return (
     <div className="bg-white" style={{ height: 600, width: "100%" }}>
       <HotTable
         data={data}
         colHeaders={true}
         nestedHeaders={nestedHeaders as any}
         rowHeaders={false}
         colWidths={colWidths}
         fixedColumnsStart={2}
         rowHeights={24}
         height={600}
         stretchH="all"
         className="hot-waterfall ht-theme-main"
         licenseKey="non-commercial-and-evaluation"
       />
     </div>
   );
 }


