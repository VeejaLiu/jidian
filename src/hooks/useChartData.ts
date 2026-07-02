import { useEffect, useState } from "react";
import { api } from "../api/client";
import { notifyError } from "../lib/notifications";
import type { ChartData } from "../types/fund";

const emptyChartData: ChartData = { nav: [], trades: [], position: null };

export function useChartData(fundId: number | null | undefined, accountQuery: () => string, refreshKey: number) {
  const [chartData, setChartData] = useState<ChartData>(emptyChartData);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadChart() {
      if (!fundId) {
        setChartData(emptyChartData);
        return;
      }

      setChartLoading(true);
      setChartData(emptyChartData);
      try {
        const payload = await api<ChartData>(`/api/assets/${fundId}/chart?${accountQuery()}`);
        if (!cancelled) {
          setChartData({
            nav: payload.prices || payload.nav || [],
            trades: payload.trades || payload.buys || [],
            position: payload.position || null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setChartData(emptyChartData);
          notifyError(error instanceof Error ? error.message : "操作失败");
        }
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    }

    loadChart();
    return () => {
      cancelled = true;
    };
  }, [accountQuery, fundId, refreshKey]);

  return { chartData, chartLoading, setChartData };
}
