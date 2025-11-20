'use client';

import React, { useMemo, useState, useRef, useEffect } from "react";
import { HotTable } from "@handsontable/react-wrapper";
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { registerAllModules } from 'handsontable/registry';

registerAllModules();


export default function DemandWaterfallTable() {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const hotTableRef = useRef<any>(null);

  const months = [
    "Mar 25", "Apr 25", "May 25", "Jun 25", "Jul 25", "Aug 25",
    "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26",
  ];

  const dates = ["24 Mar 2025", "31 Mar 2025", "7 Apr 2025", "14 Apr 2025"];
  const platforms = ["TH3K", "TR3K", "TRS+", "THSE"];

  useEffect(() => {
    if (selectedPlatforms.length === 0) {
      setSelectedPlatforms([...platforms]);
    }
  }, []);

  const data = useMemo(() => {
    const rows: (string | number)[][] = [];
    dates.forEach((d, di) => {
      platforms.filter(p => selectedPlatforms.includes(p)).forEach((p) => {
        const row: (string | number)[] = [];
        row.push(d); // Fcast Load in Date
        row.push(p); // Platform
        months.forEach((_, mi) => {
          row.push(mi === 1 && di === 2 && p === "TR3K" ? 5 : "");
          row.push(mi === 2 && di === 0 && p === "TRS+" ? 10 : "");
          row.push(mi === 0 && di === 3 && p === "THSE" ? 1 : "");
        });
        rows.push(row);
      });
    });
    return rows;
  }, [months, dates, platforms, selectedPlatforms]);

  const nestedHeaders = useMemo(() => {
    const topRow: any[] = [
      { label: "Fcast Load in Date", colspan: 1 },
      { label: "Platform", colspan: 1 },
      ...months.map(m => ({ label: m, colspan: 3 })),
    ];
    const secondRow: any[] = [
      "","",
      ...months.flatMap(() => ["SO", "Forecast", "SS"]),
    ];
    return [topRow, secondRow];
  }, [months]);

  const colWidths = useMemo(() => {
    const widths: number[] = [140, 120];
    months.forEach(() => widths.push(72, 72, 72)); // SO, Forecast, SS all same width
    return widths;
  }, [months]);

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  // Merge body cells for dates and platforms
  const mergeBodyCells = useMemo(() => {
    const merges: any[] = [];
    let startRow = 0;
    dates.forEach(d => {
      const platformCount = platforms.filter(p => selectedPlatforms.includes(p)).length;
      if (platformCount > 1) {
        merges.push({ row: startRow, col: 0, rowspan: platformCount, colspan: 1 }); // Fcast Load in Date
      }
      platforms.filter(p => selectedPlatforms.includes(p)).forEach((_, i) => {
        if (platformCount > 1) {
          merges.push({ row: startRow + i, col: 1, rowspan: 1, colspan: 1 }); // Platform (optional)
        }
      });
      startRow += platformCount;
    });
    return merges;
  }, [dates, platforms, selectedPlatforms]);

  useEffect(() => {
    if (hotTableRef.current?.hotInstance) {
      const hot = hotTableRef.current.hotInstance;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < hot.countCols(); col++) {
          const cell = hot.getCell(row, col);
          if (cell) cell.style.fontWeight = 'bold';
        }
      }
    }
  }, [data, selectedPlatforms]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
        <span className="text-sm font-medium text-neutral-700">Filter by Platform:</span>
        <div className="flex items-center gap-3 flex-wrap">
          {platforms.map(platform => (
            <label key={platform} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPlatforms.includes(platform)}
                onChange={() => togglePlatform(platform)}
                className="w-4 h-4 text-blue-600 border-neutral-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-neutral-700">{platform}</span>
            </label>
          ))}
        </div>
        {selectedPlatforms.length === 0 && (
          <span className="text-xs text-amber-600 ml-auto">No platforms selected</span>
        )}
      </div>

      <div className="bg-white" style={{ height: 600, width: "100%" }}>
        <HotTable
          ref={hotTableRef}
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
          mergeCells={mergeBodyCells}
        />
      </div>
    </div>
  );
}
