"use client";

import { ChartDataPoint } from "../types";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface ChangeSummaryTableProps {
  data: ChartDataPoint[];
}

export default function ChangeSummaryTable({ data }: ChangeSummaryTableProps) {
  return (
      <div className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-800">Change Summary by Upload</h2>
      <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 text-neutral-700">
                <th className="border-b border-neutral-200 px-3 py-2 text-left">Upload Date</th>
                <th className="border-b border-neutral-200 px-3 py-2 text-right">Shipped SO</th>
                <th className="border-b border-neutral-200 px-3 py-2 text-right">Delayed SO</th>
                <th className="border-b border-neutral-200 px-1 py-2 text-right">New Forecast</th>
                <th className="border-b border-neutral-200 px-3 py-2 text-right">F&apos;cast → SO</th>
                <th className="border-b border-neutral-200 py-2 text-right">F&apos;cast Variance</th>
                <th className="border-b border-neutral-200 px-3 py-2 text-right">Total SO</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="odd:bg-white even:bg-neutral-50 hover:bg-neutral-100/70">
                  <td className="px-3 py-2 border-t border-neutral-200">{row.uploadDate}</td>
                  <td className="px-3 py-2 border-t border-neutral-200 text-right">
                    {row.shippedJobs.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">{row.shipped}</span>
                        </TooltipTrigger>
                        <TooltipContent 
                          className="bg-white border border-neutral-200 text-neutral-800 shadow-lg max-w-md"
                          arrowClassName="bg-white border-white fill-white"
                        >
                          <div className="max-h-60 overflow-y-auto pr-1">
                            <div className="flex flex-wrap gap-1">
                              {row.shippedJobs.map((job, i) => (
                                <span key={i} className="inline-block bg-neutral-100 px-2 py-0.5 rounded text-xs">
                                  {job}
                                </span>
                              ))}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      row.shipped
                    )}
                  </td>
                  <td className="px-3 py-2 border-t border-neutral-200 text-right">
                    {row.movedToLaterJobs.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">{row.movedToLater}</span>
                        </TooltipTrigger>
                        <TooltipContent 
                          className="bg-white border border-neutral-200 text-neutral-800 shadow-lg max-w-md"
                          arrowClassName="bg-white border-white fill-white"
                        >
                          <div className="max-h-60 overflow-y-auto pr-1">
                            <div className="flex flex-wrap gap-1">
                              {row.movedToLaterJobs.map((job, i) => (
                                <span key={i} className="inline-block bg-neutral-100 px-2 py-0.5 rounded text-xs">
                                  {job}
                                </span>
                              ))}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      row.movedToLater
                    )}
                  </td>
                  <td className="px-3 py-2 border-t border-neutral-200 text-right">
                    {row.forecastLoadInsJobs.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">{row.forecastLoadIns}</span>
                        </TooltipTrigger>
                        <TooltipContent 
                          className="bg-white border border-neutral-200 text-neutral-800 shadow-lg max-w-md"
                          arrowClassName="bg-white border-white fill-white"
                        >
                          <div className="max-h-60 overflow-y-auto pr-1">
                            <div className="flex flex-wrap gap-1">
                              {row.forecastLoadInsJobs.map((job, i) => (
                                <span key={i} className="inline-block bg-neutral-100 px-2 py-0.5 rounded text-xs">
                                  {job}
                                </span>
                              ))}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      row.forecastLoadIns
                    )}
                  </td>
                  <td className="px-3 py-2 border-t border-neutral-200 text-right">
                    {row.forecastConversionsJobs.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">{row.forecastConversions}</span>
                        </TooltipTrigger>
                        <TooltipContent 
                          className="bg-white border border-neutral-200 text-neutral-800 shadow-lg max-w-md"
                          arrowClassName="bg-white border-white fill-white"
                        >
                          <div className="max-h-60 overflow-y-auto pr-1">
                            <div className="flex flex-wrap gap-1">
                              {row.forecastConversionsJobs.map((job, i) => (
                                <span key={i} className="inline-block bg-neutral-100 px-2 py-0.5 rounded text-xs">
                                  {job}
                                </span>
                              ))}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      row.forecastConversions
                    )}
                  </td>
                  <td className="px-3 py-2 border-t border-neutral-200 text-right">
                    {row.forecastVariance.positiveJobs.length > 0 || row.forecastVariance.negativeJobs.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            {row.forecastVariance.positive > 0 || row.forecastVariance.negative > 0
                              ? `+${row.forecastVariance.positive}/-${row.forecastVariance.negative}`
                              : "+0/-0"}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent 
                          className="bg-white border border-neutral-200 text-neutral-800 shadow-lg max-w-md"
                          arrowClassName="bg-white border-white fill-white"
                        >
                          <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
                            {row.forecastVariance.positiveJobs.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {row.forecastVariance.positiveJobs.map((job, i) => (
                                  <span key={i} className="inline-block bg-green-50 px-2 py-0.5 rounded text-xs border border-green-200">
                                    {job}
                                  </span>
                                ))}
                              </div>
                            )}
                            {row.forecastVariance.negativeJobs.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {row.forecastVariance.negativeJobs.map((job, i) => (
                                  <span key={i} className="inline-block bg-red-50 px-2 py-0.5 rounded text-xs border border-red-200">
                                    {job}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span>
                        {row.forecastVariance.positive > 0 || row.forecastVariance.negative > 0
                          ? `+${row.forecastVariance.positive}/-${row.forecastVariance.negative}`
                          : "+0/-0"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 border-t border-neutral-200 text-right">
                    {row.currentTotalSo}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

