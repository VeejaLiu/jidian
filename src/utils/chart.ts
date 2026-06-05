import { CHART_RANGES } from "../constants/app";
import type { ChartData } from "../types/fund";
import { shiftISODateByMonths } from "./date";

export function filterChartData(data: ChartData, rangeKey: string) {
  const range = CHART_RANGES.find((item) => item.key === rangeKey) || CHART_RANGES[2];
  const nav = data.nav || [];
  const trades = data.trades || data.buys || [];
  if (!range.months || nav.length === 0) return { nav, trades, range };

  const latestDate = nav[nav.length - 1]?.date;
  if (!latestDate) return { nav, trades, range };

  const startDate = shiftISODateByMonths(latestDate, -range.months);
  return {
    nav: nav.filter((item) => item.date >= startDate),
    trades: trades.filter((item) => item.date >= startDate),
    range,
  };
}
