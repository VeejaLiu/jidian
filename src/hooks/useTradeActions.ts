import { useCallback, type FormEvent } from "react";
import { api } from "../api/client";
import type { Fund, TradeRecord } from "../types/fund";
import { formatMoney, formatShares, tradeTypeLabel } from "../utils/format";
import type { useTradeForm } from "./useTradeForm";

type RunWithBusy = <T>(label: string, action: () => Promise<T>) => Promise<T | null>;
type TradeFormState = ReturnType<typeof useTradeForm>;

interface LoadFundsOptions {
  keepSelection?: boolean;
  preferredId?: number | null;
}

interface UseTradeActionsOptions {
  selectedFund: Fund | null;
  selectedAccountId: number | null;
  previewingHiddenFund: boolean;
  tradeForm: TradeFormState;
  runWithBusy: RunWithBusy;
  loadFunds: (options?: LoadFundsOptions) => Promise<Fund[]>;
  loadAccountSummary: (accountId?: number | null) => Promise<unknown>;
  syncPreviewFund: (fundId: number) => Promise<Fund | null | undefined>;
  refreshChart: () => void;
  busyActive: boolean;
}

export function useTradeActions({
  selectedFund,
  selectedAccountId,
  previewingHiddenFund,
  tradeForm,
  runWithBusy,
  loadFunds,
  loadAccountSummary,
  syncPreviewFund,
  refreshChart,
  busyActive,
}: UseTradeActionsOptions) {
  const refreshSelectedFund = useCallback(async () => {
    if (!selectedFund) return;
    if (previewingHiddenFund) {
      await syncPreviewFund(selectedFund.id);
    } else {
      await loadFunds({ preferredId: selectedFund.id });
    }
    await loadAccountSummary();
    refreshChart();
  }, [loadAccountSummary, loadFunds, previewingHiddenFund, refreshChart, selectedFund, syncPreviewFund]);

  const handleSubmitTrade = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFund) return;
    const isStock = selectedFund.assetType === "stock";

    runWithBusy("保存中...", async () => {
      await api(`/api/funds/${selectedFund.id}/trades`, {
        method: "POST",
        body: JSON.stringify({
          accountId: selectedAccountId,
          type: tradeForm.tradeType,
          date: tradeForm.tradeDate,
          amount: tradeForm.tradeAmount,
          nav: isStock ? tradeForm.tradePrice : undefined,
          shares: isStock ? tradeForm.tradeShares : undefined,
          fee: isStock ? tradeForm.tradeFee : undefined,
          note: tradeForm.tradeNote.trim(),
        }),
      });
      tradeForm.clearTradeForm();
      await refreshSelectedFund();
    });
  }, [refreshSelectedFund, runWithBusy, selectedAccountId, selectedFund, tradeForm]);

  const handleSubmitDividend = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFund) return;

    runWithBusy("保存分红中...", async () => {
      await api(`/api/funds/${selectedFund.id}/dividends`, {
        method: "POST",
        body: JSON.stringify({
          accountId: selectedAccountId,
          type: tradeForm.dividendType,
          date: tradeForm.dividendDate,
          amount: tradeForm.dividendAmount,
          nav: tradeForm.dividendType === "reinvest" ? tradeForm.dividendNav : undefined,
          shares: tradeForm.dividendType === "reinvest" ? tradeForm.dividendShares : undefined,
          note: tradeForm.dividendNote.trim(),
        }),
      });
      tradeForm.clearDividendForm();
      await refreshSelectedFund();
    });
  }, [refreshSelectedFund, runWithBusy, selectedAccountId, selectedFund, tradeForm]);

  const handleEditTrade = useCallback((record: TradeRecord) => {
    tradeForm.openEditTrade(record);
  }, [tradeForm]);

  const handleCloseEditTrade = useCallback(() => {
    if (busyActive) return;
    tradeForm.closeEditTrade();
  }, [busyActive, tradeForm]);

  const handleSubmitEditTrade = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFund || !tradeForm.editingTrade) return;

    runWithBusy("保存中...", async () => {
      await api(`/api/trades/${tradeForm.editingTrade.id}`, {
        method: "PUT",
        body: JSON.stringify({
          type: tradeForm.editTradeDraft.type,
          date: tradeForm.editTradeDraft.date,
          amount: tradeForm.editTradeDraft.amount,
          nav: selectedFund.assetType === "stock" ? tradeForm.editTradeDraft.price : undefined,
          shares: selectedFund.assetType === "stock" ? tradeForm.editTradeDraft.shares : undefined,
          fee: selectedFund.assetType === "stock" ? tradeForm.editTradeDraft.fee : undefined,
          note: tradeForm.editTradeDraft.note.trim(),
        }),
      });
      tradeForm.closeEditTrade();
      await refreshSelectedFund();
    });
  }, [refreshSelectedFund, runWithBusy, selectedFund, tradeForm]);

  const handleDeleteTrade = useCallback((record: TradeRecord) => {
    if (!selectedFund) return;
    const label = tradeTypeLabel(record.type);
    const unitsLabel = selectedFund.assetType === "stock" ? "股数" : "份额";
    const confirmed = window.confirm(
      `确定删除这条${label}记录吗？\n日期：${record.date}\n金额：${formatMoney(record.amount)}\n${unitsLabel}：${formatShares(record.shares)}`,
    );
    if (!confirmed) return;

    runWithBusy("删除中...", async () => {
      await api(`/api/trades/${record.id}`, { method: "DELETE" });
      await refreshSelectedFund();
    });
  }, [refreshSelectedFund, runWithBusy, selectedFund]);

  return {
    handleSubmitTrade,
    handleSubmitDividend,
    handleEditTrade,
    handleCloseEditTrade,
    handleSubmitEditTrade,
    handleDeleteTrade,
  };
}
