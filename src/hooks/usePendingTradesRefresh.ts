import { useEffect } from "react";
import type { Fund } from "../types/fund";

interface LoadFundsOptions {
  keepSelection?: boolean;
  preferredId?: number | null;
}

interface UsePendingTradesRefreshOptions {
  selectedFund: Fund | null;
  selectedFundId: number | null;
  loadFunds: (options?: LoadFundsOptions) => Promise<Fund[]>;
  refreshChart: () => void;
}

export function usePendingTradesRefresh({
  selectedFund,
  selectedFundId,
  loadFunds,
  refreshChart,
}: UsePendingTradesRefreshOptions) {
  useEffect(() => {
    if (!selectedFundId || !selectedFund?.trades?.some((trade) => trade.status === "pending")) return undefined;

    const timer = window.setInterval(() => {
      loadFunds({ preferredId: selectedFundId })
        .then(refreshChart)
        .catch(() => {
          // 静默刷新失败不打断当前操作，下一轮再试。
        });
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, [loadFunds, refreshChart, selectedFund, selectedFundId]);
}
