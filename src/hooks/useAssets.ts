import { useCallback, useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { notifyError } from "../lib/notifications";
import type { AssetDraft, Fund } from "../types/fund";

type RunWithBusy = <T>(label: string, action: () => Promise<T>) => Promise<T | null>;

interface LoadFundsOptions {
  keepSelection?: boolean;
  preferredId?: number | null;
}

interface UseAssetsOptions {
  selectedAccountId: number | null;
  accountQuery: () => string;
  runWithBusy: RunWithBusy;
  loadAccountSummary: (accountId?: number | null) => Promise<unknown>;
  refreshChart: () => void;
  closeNavModal: () => void;
  onAssetAdded?: () => void;
}

export function useAssets({
  selectedAccountId,
  accountQuery,
  runWithBusy,
  loadAccountSummary,
  refreshChart,
  closeNavModal,
  onAssetAdded,
}: UseAssetsOptions) {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [selectedFundId, setSelectedFundId] = useState<number | null>(null);
  const [assetDraft, setAssetDraft] = useState<AssetDraft>({
    assetType: "fund",
    code: "",
    name: "",
  });
  const [addingFundBusy, setAddingFundBusy] = useState(false);
  const [hiddenFunds, setHiddenFunds] = useState<Fund[]>([]);
  const [hiddenFundsLoading, setHiddenFundsLoading] = useState(false);
  const [previewFund, setPreviewFund] = useState<Fund | null>(null);

  const selectedVisibleFund = useMemo(
    () => funds.find((fund) => fund.id === selectedFundId) || null,
    [funds, selectedFundId],
  );
  const selectedFund = previewFund || selectedVisibleFund;
  const previewingHiddenFund = Boolean(previewFund);

  const loadFunds = useCallback(async ({ keepSelection = true, preferredId = null }: LoadFundsOptions = {}) => {
    if (!selectedAccountId) {
      setFunds([]);
      setSelectedFundId(null);
      return [];
    }
    const payload = await api<{ funds: Fund[] }>(`/api/assets?${accountQuery()}`);
    const nextFunds = payload.funds || [];
    setFunds(nextFunds);
    setSelectedFundId((currentId) => {
      if (preferredId && nextFunds.some((fund) => fund.id === preferredId)) return preferredId;
      if (keepSelection && nextFunds.some((fund) => fund.id === currentId)) return currentId;
      return nextFunds[0]?.id ?? null;
    });
    return nextFunds;
  }, [accountQuery, selectedAccountId]);

  const loadHiddenFunds = useCallback(async () => {
    if (!selectedAccountId) return;
    setHiddenFundsLoading(true);
    try {
      const payload = await api<{ funds: Fund[] }>(`/api/hidden-assets?${accountQuery()}`);
      const nextFunds = payload.funds || [];
      setHiddenFunds(nextFunds);
      return nextFunds;
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "操作失败");
    } finally {
      setHiddenFundsLoading(false);
    }
  }, [accountQuery, selectedAccountId]);

  const syncPreviewFund = useCallback(async (fundId: number) => {
    const nextHiddenFunds = await loadHiddenFunds();
    const nextPreviewFund = nextHiddenFunds?.find((fund) => fund.id === fundId) || null;
    setPreviewFund(nextPreviewFund);
    return nextPreviewFund;
  }, [loadHiddenFunds]);

  const resetAssets = useCallback(() => {
    setFunds([]);
    setSelectedFundId(null);
    setPreviewFund(null);
  }, []);

  const resetHiddenFunds = useCallback(() => {
    setHiddenFunds([]);
  }, []);

  const handleAddFund = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = assetDraft.code.trim();
    const name = assetDraft.name.trim();
    if ((!code && !name) || addingFundBusy) return;

    async function addFund() {
      setAddingFundBusy(true);
      try {
        const payload = await api<{ fund: Fund }>("/api/assets", {
          method: "POST",
          body: JSON.stringify({
            code,
            name,
            assetType: assetDraft.assetType,
            accountId: selectedAccountId,
          }),
        });
        const fundId = payload.fund.id;
        setSelectedFundId(fundId);
        setAssetDraft({ assetType: "fund", code: "", name: "" });
        onAssetAdded?.();
        await loadFunds({ preferredId: fundId });
        await loadAccountSummary();
        refreshChart();
      } catch (error) {
        notifyError(error instanceof Error ? error.message : "操作失败");
      } finally {
        setAddingFundBusy(false);
      }
    }

    addFund();
  }, [addingFundBusy, assetDraft, loadAccountSummary, loadFunds, onAssetAdded, refreshChart, selectedAccountId]);

  const handleHideFund = useCallback(async () => {
    if (!selectedFund) return false;

    const result = await runWithBusy("隐藏中...", async () => {
      await api(`/api/assets/${selectedFund.id}?${accountQuery()}`, { method: "DELETE" });
      const nextHiddenFunds = await loadHiddenFunds();
      const nextPreviewFund = nextHiddenFunds?.find((fund) => fund.id === selectedFund.id) || selectedFund;
      setPreviewFund(nextPreviewFund);
      await loadFunds({ keepSelection: false });
      await loadAccountSummary();
      closeNavModal();
      refreshChart();
      return true;
    });
    return Boolean(result);
  }, [accountQuery, closeNavModal, loadAccountSummary, loadFunds, loadHiddenFunds, refreshChart, runWithBusy, selectedFund]);

  const handleRestoreFund = useCallback((fund: Fund, onRestored?: () => void) => {
    runWithBusy("恢复中...", async () => {
      await api(`/api/assets/${fund.id}/restore?${accountQuery()}`, { method: "POST" });
      if (previewFund?.id === fund.id) setPreviewFund(null);
      await loadFunds({ preferredId: fund.id });
      await loadAccountSummary();
      await loadHiddenFunds();
      onRestored?.();
      refreshChart();
    });
  }, [accountQuery, loadAccountSummary, loadFunds, loadHiddenFunds, previewFund?.id, refreshChart, runWithBusy]);

  const handleSelectVisibleFund = useCallback((fundId: number) => {
    setPreviewFund(null);
    setSelectedFundId(fundId);
  }, []);

  const handlePreviewHiddenFund = useCallback((fund: Fund) => {
    setPreviewFund(fund);
    refreshChart();
  }, [refreshChart]);

  return {
    funds,
    setFunds,
    selectedFundId,
    setSelectedFundId,
    selectedFund,
    previewFund,
    setPreviewFund,
    previewingHiddenFund,
    assetDraft,
    setAssetDraft,
    addingFundBusy,
    hiddenFunds,
    hiddenFundsLoading,
    setHiddenFunds,
    loadFunds,
    loadHiddenFunds,
    syncPreviewFund,
    resetAssets,
    resetHiddenFunds,
    handleAddFund,
    handleHideFund,
    handleRestoreFund,
    handleSelectVisibleFund,
    handlePreviewHiddenFund,
  };
}
