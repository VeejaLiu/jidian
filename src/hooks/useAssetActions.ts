import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { notifyError } from "../lib/notifications";
import type { Fund } from "../types/fund";
import { todayISO } from "../utils/date";

type RunWithBusy = <T>(label: string, action: () => Promise<T>) => Promise<T | null>;

interface LoadFundsOptions {
  keepSelection?: boolean;
  preferredId?: number | null;
}

interface UseAssetActionsOptions {
  selectedFund: Fund | null;
  selectedAccountId: number | null;
  previewingHiddenFund: boolean;
  setPreviewFund: (fund: Fund | null) => void;
  syncPreviewFund: (fundId: number) => Promise<Fund | null | undefined>;
  loadFunds: (options?: LoadFundsOptions) => Promise<Fund[]>;
  loadAccountSummary: (accountId?: number | null) => Promise<unknown>;
  refreshChart: () => void;
  runWithBusy: RunWithBusy;
}

export function useAssetActions({
  selectedFund,
  selectedAccountId,
  previewingHiddenFund,
  setPreviewFund,
  syncPreviewFund,
  loadFunds,
  loadAccountSummary,
  refreshChart,
  runWithBusy,
}: UseAssetActionsOptions) {
  const [dropRateDraft, setDropRateDraft] = useState("");
  const [manualPriceDraft, setManualPriceDraft] = useState({ date: todayISO(), price: "", accumulatedNav: "" });

  useEffect(() => {
    if (!selectedFund) {
      setDropRateDraft("");
      return;
    }
    setDropRateDraft(((Number(selectedFund.dropRate) || 0.04) * 100).toFixed(1));
  }, [selectedFund?.id, selectedFund?.dropRate]);

  const refreshSelectedFund = useCallback(async (preferredId: number) => {
    if (previewingHiddenFund) {
      await syncPreviewFund(preferredId);
    } else {
      await loadFunds({ preferredId });
    }
    await loadAccountSummary();
    refreshChart();
  }, [loadAccountSummary, loadFunds, previewingHiddenFund, refreshChart, syncPreviewFund]);

  const handleSyncNav = useCallback(async () => {
    if (!selectedFund) return false;
    const isStock = selectedFund.assetType === "stock";

    const result = await runWithBusy(isStock ? "更新价格中..." : "更新净值中...", async () => {
      const payload = await api<{ fund: Fund; sync?: { imported?: number; confirmedTrades?: number } }>(
        isStock ? `/api/assets/${selectedFund.id}/sync-price` : `/api/funds/${selectedFund.id}/sync-nav`,
        {
          method: "POST",
          body: JSON.stringify({ accountId: selectedAccountId, fullHistory: false }),
        },
      );
      if (previewingHiddenFund) {
        setPreviewFund(payload.fund || null);
        await syncPreviewFund(payload.fund?.id || selectedFund.id);
      } else {
        await loadFunds({ preferredId: payload.fund?.id || selectedFund.id });
      }
      await loadAccountSummary();
      refreshChart();
      return true;
    });
    return Boolean(result);
  }, [loadAccountSummary, loadFunds, previewingHiddenFund, refreshChart, runWithBusy, selectedAccountId, selectedFund, setPreviewFund, syncPreviewFund]);

  const handleSaveDropRate = useCallback(async () => {
    if (!selectedFund) return false;

    const value = Number(dropRateDraft);
    const currentValue = (Number(selectedFund.dropRate) || 0.04) * 100;
    if (!Number.isFinite(value) || value <= 0 || value >= 100) {
      notifyError("跌幅幅度必须大于 0 且小于 100%");
      setDropRateDraft(currentValue.toFixed(1));
      return false;
    }

    if (Math.abs(value - currentValue) < 0.0001) return true;

    const result = await runWithBusy("保存跌幅中...", async () => {
      await api<{ fund: Fund }>(`/api/funds/${selectedFund.id}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ accountId: selectedAccountId, dropRatePercent: value }),
      });
      await refreshSelectedFund(selectedFund.id);
      return true;
    });
    return Boolean(result);
  }, [dropRateDraft, refreshSelectedFund, runWithBusy, selectedAccountId, selectedFund]);

  const handleSaveManualPrice = useCallback(async () => {
    if (!selectedFund) return false;

    const price = Number(manualPriceDraft.price);
    const accumulatedNav = Number(manualPriceDraft.accumulatedNav);
    if (!manualPriceDraft.date || !Number.isFinite(price) || price <= 0) {
      notifyError(selectedFund.assetType === "stock" ? "价格必须大于 0" : "单位净值必须大于 0");
      return false;
    }

    const result = await runWithBusy("保存补录中...", async () => {
      const isStock = selectedFund.assetType === "stock";
      await api(isStock ? `/api/assets/${selectedFund.id}/prices` : `/api/funds/${selectedFund.id}/nav`, {
        method: "POST",
        body: JSON.stringify({
          accountId: selectedAccountId,
          date: manualPriceDraft.date,
          nav: price,
          accumulatedNav: Number.isFinite(accumulatedNav) && accumulatedNav > 0 ? accumulatedNav : undefined,
        }),
      });
      setManualPriceDraft({ date: todayISO(), price: "", accumulatedNav: "" });
      await refreshSelectedFund(selectedFund.id);
      return true;
    });
    return Boolean(result);
  }, [manualPriceDraft, refreshSelectedFund, runWithBusy, selectedAccountId, selectedFund]);

  return {
    dropRateDraft,
    setDropRateDraft,
    manualPriceDraft,
    setManualPriceDraft,
    handleSyncNav,
    handleSaveDropRate,
    handleSaveManualPrice,
  };
}
