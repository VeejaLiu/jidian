import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { notifyError, notifySuccess } from "../lib/notifications";
import type { Fund } from "../types/fund";
import { todayISO } from "../utils/date";

type RunWithBusy = <T>(label: string, action: () => Promise<T>) => Promise<T | null>;

interface SyncResult {
  imported?: number;
  confirmedTrades?: number;
  sourceRecords?: number;
  startDate?: string;
  endDate?: string | null;
  skipped?: boolean;
  reason?: "syncing" | "up-to-date" | string;
}

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
      const payload = await api<{ fund: Fund; sync?: SyncResult }>(
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
      notifySuccess(getSyncResultMessage(isStock, payload.sync));
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

function getSyncResultMessage(isStock: boolean, sync?: SyncResult) {
  const assetLabel = isStock ? "价格" : "净值";
  if (sync?.skipped && sync.reason === "syncing") return `${assetLabel}正在同步中，请稍后刷新查看结果。`;
  if (sync?.skipped && sync.reason === "up-to-date") return `${assetLabel}已经是最新，无需更新。`;

  const imported = Number(sync?.imported || 0);
  const confirmedTrades = Number(sync?.confirmedTrades || 0);
  const checkedFrom = sync?.startDate ? `已检查 ${sync.startDate} 至今的数据源。` : "已检查全部历史数据源。";
  if (confirmedTrades > 0) return `同步完成，新增或更新 ${imported} 条${assetLabel}，确认 ${confirmedTrades} 笔待确认交易。`;
  if (imported > 0) return `同步完成，新增或更新 ${imported} 条${assetLabel}。`;
  if (Number(sync?.sourceRecords) === 0) return `同步完成，数据源在该范围内没有返回${assetLabel}。${checkedFrom}`;
  return `同步完成，${assetLabel}数据没有变化。${checkedFrom}`;
}
