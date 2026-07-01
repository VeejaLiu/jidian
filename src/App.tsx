import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AccountModal } from "./components/account/AccountModal";
import { BackupImportPreviewModal, type BackupImportPreview } from "./components/account/BackupImportPreviewModal";
import { AddFundModal } from "./components/fund/AddFundModal";
import { FundSidebar } from "./components/fund/FundSidebar";
import { HiddenFundsModal } from "./components/fund/HiddenFundsModal";
import { NavHistoryModal, type NavModalState } from "./components/nav/NavHistoryModal";
import { EditTradeModal } from "./components/trade/EditTradeModal";
import { Workspace } from "./components/Workspace";
import { api } from "./api/client";
import { DEFAULT_BUSY_LABEL, MIN_NAV_MODAL_LOADING_MS } from "./constants/app";
import { useChartData } from "./hooks/useChartData";
import { useTradeForm } from "./hooks/useTradeForm";
import type { AccountSummary, AssetDraft, BackupPayload, Fund, NavHistoryPage, TradeRecord, UserAccount } from "./types/fund";
import { todayISO } from "./utils/date";
import { formatMoney, formatShares, tradeTypeLabel } from "./utils/format";

interface BusyState {
  active: boolean;
  label: string;
}

export function App() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [accountSummary, setAccountSummary] = useState<AccountSummary | null>(null);
  const [accountSummaryLoading, setAccountSummaryLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedFundId, setSelectedFundId] = useState<number | null>(null);
  const [busy, setBusy] = useState<BusyState>({ active: false, label: DEFAULT_BUSY_LABEL });
  const [assetDraft, setAssetDraft] = useState<AssetDraft>({
    assetType: "fund",
    code: "",
    name: "",
  });
  const [fundSearch, setFundSearch] = useState("");
  const [dropRateDraft, setDropRateDraft] = useState("");
  const [manualPriceDraft, setManualPriceDraft] = useState({ date: todayISO(), price: "", accumulatedNav: "" });
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [addFundModalOpen, setAddFundModalOpen] = useState(false);
  const [addingFundBusy, setAddingFundBusy] = useState(false);
  const [hiddenFundsModalOpen, setHiddenFundsModalOpen] = useState(false);
  const [hiddenFunds, setHiddenFunds] = useState<Fund[]>([]);
  const [hiddenFundsLoading, setHiddenFundsLoading] = useState(false);
  const [previewFund, setPreviewFund] = useState<Fund | null>(null);
  const [backupImportDraft, setBackupImportDraft] = useState<{ file: File; payload: BackupPayload; preview: BackupImportPreview } | null>(null);
  const [chartRefreshKey, setChartRefreshKey] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [navModal, setNavModal] = useState<NavModalState>({
    open: false,
    page: 1,
    pageSize: 20,
    rows: [],
    total: 0,
    totalPages: 1,
    loading: false,
  });

  const selectedVisibleFund = useMemo(
    () => funds.find((fund) => fund.id === selectedFundId) || null,
    [funds, selectedFundId],
  );
  const selectedFund = previewFund || selectedVisibleFund;
  const previewingHiddenFund = Boolean(previewFund);
  const hasPendingTrades = useMemo(
    () => Boolean(selectedFund?.trades?.some((trade) => trade.status === "pending")),
    [selectedFund],
  );
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) || null,
    [accounts, selectedAccountId],
  );
  const isStock = selectedFund?.assetType === "stock";
  const tradeForm = useTradeForm(selectedFund?.assetType);

  useEffect(() => {
    if (!selectedFund) {
      setDropRateDraft("");
      return;
    }
    setDropRateDraft(((Number(selectedFund.dropRate) || 0.04) * 100).toFixed(1));
  }, [selectedFund?.id, selectedFund?.dropRate]);

  const accountQuery = useCallback(
    () => (selectedAccountId ? `accountId=${encodeURIComponent(selectedAccountId)}` : ""),
    [selectedAccountId],
  );
  const { chartData, chartLoading, setChartData } = useChartData(selectedFund?.id, accountQuery, chartRefreshKey);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier) return;
      const key = event.key.toLowerCase();
      if (key === "n") {
        event.preventDefault();
        if (!busy.active && !addingFundBusy) handleOpenAddFund();
      }
      if (key === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (key === "r") {
        event.preventDefault();
        if (!busy.active && selectedFund) handleSyncNav();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addingFundBusy, busy.active, selectedFund]);

  const runWithBusy = useCallback(async <T,>(label: string, action: () => Promise<T>) => {
    setBusy({ active: true, label });
    try {
      return await action();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
      return null;
    } finally {
      setBusy({ active: false, label: DEFAULT_BUSY_LABEL });
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    const payload = await api<{ accounts: UserAccount[] }>("/api/accounts");
    const nextAccounts = payload.accounts || [];
    setAccounts(nextAccounts);
    setSelectedAccountId((currentId) => {
      if (currentId && nextAccounts.some((account) => account.id === currentId)) return currentId;
      return nextAccounts[0]?.id ?? null;
    });
    return nextAccounts;
  }, []);

  const loadFunds = useCallback(async ({ keepSelection = true, preferredId = null }: { keepSelection?: boolean; preferredId?: number | null } = {}) => {
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

  const loadAccountSummary = useCallback(async (accountId = selectedAccountId) => {
    if (!accountId) {
      setAccountSummary(null);
      return null;
    }
    setAccountSummaryLoading(true);
    try {
      const payload = await api<AccountSummary>(`/api/accounts/${accountId}/summary`);
      setAccountSummary(payload);
      return payload;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
      return null;
    } finally {
      setAccountSummaryLoading(false);
    }
  }, [selectedAccountId]);

  const loadNavPage = useCallback(async (fundId: number, page = 1) => {
    setNavModal((current) => ({ ...current, loading: true }));
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      const [payload] = await Promise.all([
        api<NavHistoryPage>(`/api/assets/${fundId}/prices?${params.toString()}`),
        new Promise((resolve) => window.setTimeout(resolve, MIN_NAV_MODAL_LOADING_MS)),
      ]);
      setNavModal((current) => ({
        ...current,
        page: payload.page,
        pageSize: payload.pageSize,
        rows: payload.rows || [],
        total: payload.total || 0,
        totalPages: payload.totalPages || 1,
        loading: false,
      }));
    } catch (error) {
      setNavModal((current) => ({ ...current, loading: false }));
      throw error;
    }
  }, []);

  const loadHiddenFunds = useCallback(async () => {
    if (!selectedAccountId) return;
    setHiddenFundsLoading(true);
    try {
      const payload = await api<{ funds: Fund[] }>(`/api/hidden-assets?${accountQuery()}`);
      const nextFunds = payload.funds || [];
      setHiddenFunds(nextFunds);
      return nextFunds;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
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

  useEffect(() => {
    runWithBusy("加载中...", loadAccounts);
  }, [loadAccounts, runWithBusy]);

  useEffect(() => {
    if (!selectedAccountId) return;
    setPreviewFund(null);
    runWithBusy("加载中...", () => loadFunds({ keepSelection: false }));
    loadAccountSummary();
  }, [loadAccountSummary, loadFunds, runWithBusy, selectedAccountId]);

  useEffect(() => {
    if (!selectedFundId || !hasPendingTrades) return undefined;

    const timer = window.setInterval(() => {
      loadFunds({ preferredId: selectedFundId })
        .then(() => setChartRefreshKey((key) => key + 1))
        .catch(() => {
          // 静默刷新失败不打断当前操作，下一轮再试。
        });
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, [hasPendingTrades, loadFunds, selectedFundId]);

  const handleAddFund = (event: FormEvent<HTMLFormElement>) => {
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
        setAddFundModalOpen(false);

        await loadFunds({ preferredId: fundId });
        await loadAccountSummary();
        setChartRefreshKey((key) => key + 1);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "操作失败");
      } finally {
        setAddingFundBusy(false);
      }
    }

    addFund();
  };

  const handleCreateAccount = (name: string) => {
    runWithBusy("创建账户中...", async () => {
      const payload = await api<{ account: UserAccount }>("/api/accounts", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await loadAccounts();
      setSelectedAccountId(payload.account.id);
      await loadAccountSummary(payload.account.id);
      setFunds([]);
      setSelectedFundId(null);
      setChartRefreshKey((key) => key + 1);
    });
  };

  const handleRenameAccount = (account: UserAccount, name: string) => {
    runWithBusy("重命名中...", async () => {
      await api(`/api/accounts/${account.id}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      });
      await loadAccounts();
      await loadAccountSummary();
    });
  };

  const handleDeleteAccount = (account: UserAccount) => {
    const confirmed = window.confirm(`确定删除「${account.name}」吗？这个账户下的基金列表和交易记录会一起删除，公共净值库不会删除。`);
    if (!confirmed) return;

    runWithBusy("删除账户中...", async () => {
      await api(`/api/accounts/${account.id}`, { method: "DELETE" });
      const nextAccounts = await loadAccounts();
      if (account.id === selectedAccountId) {
        const nextAccountId = nextAccounts.find((item) => item.id !== account.id)?.id ?? nextAccounts[0]?.id ?? null;
        setSelectedAccountId(nextAccountId);
        setFunds([]);
        setSelectedFundId(null);
        setChartRefreshKey((key) => key + 1);
        await loadAccountSummary(nextAccountId);
      }
    });
  };

  const handleSelectAccount = (accountId: number) => {
    setSelectedAccountId(accountId);
    setFunds([]);
    setSelectedFundId(null);
    setPreviewFund(null);
    setFundSearch("");
      setHiddenFunds([]);
      setAccountModalOpen(false);
      loadAccountSummary(accountId);
      setChartRefreshKey((key) => key + 1);
  };

  const handleExportBackup = () => {
    runWithBusy("导出备份中...", async () => {
      const payload = await api<BackupPayload>("/api/backup/export");
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/:/g, "-");
      link.href = url;
      link.download = `jidian-backup-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return true;
    });
  };

  const handlePreviewBackupImport = (file: File) => {
    runWithBusy("校验备份中...", async () => {
      const text = await file.text();
      const payload = JSON.parse(text) as BackupPayload;
      const result = await api<{ preview: BackupImportPreview }>("/api/backup/preview", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setBackupImportDraft({ file, payload, preview: result.preview });
      return true;
    });
  };

  const handleImportBackup = () => {
    if (!backupImportDraft) return;
    runWithBusy("导入备份中...", async () => {
      await api("/api/backup/import", {
        method: "POST",
        body: JSON.stringify(backupImportDraft.payload),
      });
      setBackupImportDraft(null);
      setPreviewFund(null);
      setFundSearch("");
      setHiddenFunds([]);
      setAccountSummary(null);
      setSelectedFundId(null);
      setChartData({ nav: [], trades: [], position: null });
      const nextAccounts = await loadAccounts();
      const nextAccountId = nextAccounts[0]?.id ?? null;
      setSelectedAccountId(nextAccountId);
      await loadAccountSummary(nextAccountId);
      setChartRefreshKey((key) => key + 1);
      window.alert("导入完成");
      return true;
    });
  };

  const handleOpenAddFund = () => {
    setAddFundModalOpen(true);
  };

  const handleCloseAddFund = () => {
    if (addingFundBusy) return;
    setAssetDraft({ assetType: "fund", code: "", name: "" });
    setAddFundModalOpen(false);
  };

  const handleOpenHiddenFunds = () => {
    setHiddenFundsModalOpen(true);
    loadHiddenFunds();
  };

  const handleCloseHiddenFunds = () => {
    if (busy.active) return;
    setHiddenFundsModalOpen(false);
  };

  const handlePreviewHiddenFund = (fund: Fund) => {
    setPreviewFund(fund);
    setHiddenFundsModalOpen(false);
    setChartRefreshKey((key) => key + 1);
  };

  const handleSubmitTrade = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFund) return;

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
      if (previewingHiddenFund) {
        await syncPreviewFund(selectedFund.id);
      } else {
        await loadFunds({ preferredId: selectedFund.id });
      }
      await loadAccountSummary();
      setChartRefreshKey((key) => key + 1);
    });
  };

  const handleSubmitDividend = (event: FormEvent<HTMLFormElement>) => {
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
      if (previewingHiddenFund) {
        await syncPreviewFund(selectedFund.id);
      } else {
        await loadFunds({ preferredId: selectedFund.id });
      }
      await loadAccountSummary();
      setChartRefreshKey((key) => key + 1);
    });
  };

  const handleSyncNav = async () => {
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
      setChartRefreshKey((key) => key + 1);
      return true;
    });
    return Boolean(result);
  };

  const handleSaveDropRate = async () => {
    if (!selectedFund) return false;

    const value = Number(dropRateDraft);
    const currentValue = (Number(selectedFund.dropRate) || 0.04) * 100;
    if (!Number.isFinite(value) || value <= 0 || value >= 100) {
      window.alert("跌幅幅度必须大于 0 且小于 100%");
      setDropRateDraft(currentValue.toFixed(1));
      return false;
    }

    if (Math.abs(value - currentValue) < 0.0001) return true;

    const result = await runWithBusy("保存跌幅中...", async () => {
      await api<{ fund: Fund }>(`/api/funds/${selectedFund.id}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ accountId: selectedAccountId, dropRatePercent: value }),
      });
      if (previewingHiddenFund) {
        await syncPreviewFund(selectedFund.id);
      } else {
        await loadFunds({ preferredId: selectedFund.id });
      }
      await loadAccountSummary();
      setChartRefreshKey((key) => key + 1);
      return true;
    });
    return Boolean(result);
  };

  const handleSaveManualPrice = async () => {
    if (!selectedFund) return false;

    const price = Number(manualPriceDraft.price);
    const accumulatedNav = Number(manualPriceDraft.accumulatedNav);
    if (!manualPriceDraft.date || !Number.isFinite(price) || price <= 0) {
      window.alert(selectedFund.assetType === "stock" ? "价格必须大于 0" : "单位净值必须大于 0");
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
      if (previewingHiddenFund) {
        await syncPreviewFund(selectedFund.id);
      } else {
        await loadFunds({ preferredId: selectedFund.id });
      }
      await loadAccountSummary();
      setChartRefreshKey((key) => key + 1);
      return true;
    });
    return Boolean(result);
  };

  const handleViewAllNav = () => {
    if (!selectedFund) return;

    setNavModal((current) => ({ ...current, open: true, page: 1, rows: [], total: 0, totalPages: 1 }));
    loadNavPage(selectedFund.id, 1).catch((error) =>
      window.alert(error instanceof Error ? error.message : "操作失败"),
    );
  };

  const handleEditTrade = (record: TradeRecord) => {
    tradeForm.openEditTrade(record);
  };

  const handleCloseEditTrade = () => {
    if (busy.active) return;
    tradeForm.closeEditTrade();
  };

  const handleSubmitEditTrade = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFund || !tradeForm.editingTrade) return;

    runWithBusy("保存中...", async () => {
      await api(`/api/trades/${tradeForm.editingTrade.id}`, {
        method: "PUT",
        body: JSON.stringify({
          type: tradeForm.editTradeDraft.type,
          date: tradeForm.editTradeDraft.date,
          amount: tradeForm.editTradeDraft.amount,
          nav: selectedFund?.assetType === "stock" ? tradeForm.editTradeDraft.price : undefined,
          shares: selectedFund?.assetType === "stock" ? tradeForm.editTradeDraft.shares : undefined,
          fee: selectedFund?.assetType === "stock" ? tradeForm.editTradeDraft.fee : undefined,
          note: tradeForm.editTradeDraft.note.trim(),
        }),
      });
      tradeForm.closeEditTrade();
      if (previewingHiddenFund) {
        await syncPreviewFund(selectedFund.id);
      } else {
        await loadFunds({ preferredId: selectedFund.id });
      }
      await loadAccountSummary();
      setChartRefreshKey((key) => key + 1);
    });
  };

  const handleDeleteTrade = (record: TradeRecord) => {
    if (!selectedFund) return;
    const label = tradeTypeLabel(record.type);
    const unitsLabel = selectedFund.assetType === "stock" ? "股数" : "份额";
    const confirmed = window.confirm(
      `确定删除这条${label}记录吗？\n日期：${record.date}\n金额：${formatMoney(record.amount)}\n${unitsLabel}：${formatShares(record.shares)}`,
    );
    if (!confirmed) return;

    runWithBusy("删除中...", async () => {
      await api(`/api/trades/${record.id}`, { method: "DELETE" });
      if (previewingHiddenFund) {
        await syncPreviewFund(selectedFund.id);
      } else {
        await loadFunds({ preferredId: selectedFund.id });
      }
      await loadAccountSummary();
      setChartRefreshKey((key) => key + 1);
    });
  };

  const handleHideFund = async () => {
    if (!selectedFund) return false;

    const result = await runWithBusy("隐藏中...", async () => {
      await api(`/api/assets/${selectedFund.id}?${accountQuery()}`, { method: "DELETE" });
      const nextHiddenFunds = await loadHiddenFunds();
      const nextPreviewFund = nextHiddenFunds?.find((fund) => fund.id === selectedFund.id) || selectedFund;
      setPreviewFund(nextPreviewFund);
      await loadFunds({ keepSelection: false });
      await loadAccountSummary();
      setNavModal((current) => ({ ...current, open: false }));
      setChartRefreshKey((key) => key + 1);
      return true;
    });
    return Boolean(result);
  };

  const handleRestoreFund = (fund: Fund) => {
    runWithBusy("恢复中...", async () => {
      await api(`/api/assets/${fund.id}/restore?${accountQuery()}`, { method: "POST" });
      if (previewFund?.id === fund.id) setPreviewFund(null);
      await loadFunds({ preferredId: fund.id });
      await loadAccountSummary();
      await loadHiddenFunds();
      setHiddenFundsModalOpen(false);
      setChartRefreshKey((key) => key + 1);
    });
  };

  const handleSelectVisibleFund = (fundId: number) => {
    setPreviewFund(null);
    setSelectedFundId(fundId);
  };

  const closeNavModal = useCallback(() => {
    setNavModal((current) => ({ ...current, open: false }));
  }, []);

  const handlePrevNavPage = () => {
    if (!selectedFund || navModal.page <= 1) return;
    loadNavPage(selectedFund.id, navModal.page - 1).catch((error) =>
      window.alert(error instanceof Error ? error.message : "操作失败"),
    );
  };

  const handleNextNavPage = () => {
    if (!selectedFund || navModal.page >= navModal.totalPages) return;
    loadNavPage(selectedFund.id, navModal.page + 1).catch((error) =>
      window.alert(error instanceof Error ? error.message : "操作失败"),
    );
  };

  return (
    <>
      <main className="app-shell">
        <FundSidebar
          funds={funds}
          selectedAccount={selectedAccount}
          selectedFundId={previewingHiddenFund ? null : selectedFundId}
          busy={busy.active}
          addingBusy={addingFundBusy}
          searchValue={fundSearch}
          searchInputRef={searchInputRef}
          onSearchChange={setFundSearch}
          onOpenAddFund={handleOpenAddFund}
          onOpenHiddenFunds={handleOpenHiddenFunds}
          onOpenAccountModal={() => setAccountModalOpen(true)}
          onSelectFund={handleSelectVisibleFund}
        />
        <Workspace
          fund={selectedFund}
          selectedAccount={selectedAccount}
          accountSummary={accountSummary}
          accountSummaryLoading={accountSummaryLoading}
          previewingHiddenFund={previewingHiddenFund}
          busy={busy.active}
          busyLabel={busy.label}
          chartData={chartData}
          chartLoading={chartLoading}
          dropRateDraft={dropRateDraft}
          manualPriceDraft={manualPriceDraft}
          tradeType={tradeForm.tradeType}
          tradeDate={tradeForm.tradeDate}
          tradeAmount={tradeForm.tradeAmount}
          tradePrice={tradeForm.tradePrice}
          tradeShares={tradeForm.tradeShares}
          tradeFee={tradeForm.tradeFee}
          tradeNote={tradeForm.tradeNote}
          dividendType={tradeForm.dividendType}
          dividendDate={tradeForm.dividendDate}
          dividendAmount={tradeForm.dividendAmount}
          dividendNav={tradeForm.dividendNav}
          dividendShares={tradeForm.dividendShares}
          dividendNote={tradeForm.dividendNote}
          onHideFund={handleHideFund}
          onSyncNav={handleSyncNav}
          onDropRateDraftChange={setDropRateDraft}
          onManualPriceDraftChange={setManualPriceDraft}
          onSaveDropRate={handleSaveDropRate}
          onSaveManualPrice={handleSaveManualPrice}
          onViewAllNav={handleViewAllNav}
          onSubmitTrade={handleSubmitTrade}
          onTradeTypeChange={tradeForm.setTradeType}
          onTradeDateChange={tradeForm.setTradeDate}
          onTradeAmountChange={tradeForm.setTradeAmount}
          onTradePriceChange={tradeForm.setTradePrice}
          onTradeSharesChange={tradeForm.setTradeShares}
          onTradeFeeChange={tradeForm.setTradeFee}
          onTradeNoteChange={tradeForm.setTradeNote}
          onDividendTypeChange={tradeForm.setDividendType}
          onDividendDateChange={tradeForm.setDividendDate}
          onDividendAmountChange={tradeForm.setDividendAmount}
          onDividendNavChange={tradeForm.setDividendNav}
          onDividendSharesChange={tradeForm.setDividendShares}
          onDividendNoteChange={tradeForm.setDividendNote}
          onSubmitDividend={handleSubmitDividend}
          onEditTrade={handleEditTrade}
          onDeleteTrade={handleDeleteTrade}
        />
      </main>
      <AccountModal
        open={accountModalOpen}
        accounts={accounts}
        selectedAccount={selectedAccount}
        busy={busy.active}
        onClose={() => setAccountModalOpen(false)}
        onSelectAccount={handleSelectAccount}
        onCreateAccount={handleCreateAccount}
        onRenameAccount={handleRenameAccount}
        onDeleteAccount={handleDeleteAccount}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onPreviewBackupImport={handlePreviewBackupImport}
      />
      <BackupImportPreviewModal
        open={Boolean(backupImportDraft)}
        fileName={backupImportDraft?.file.name || ""}
        preview={backupImportDraft?.preview || null}
        busy={busy.active}
        onCancel={() => setBackupImportDraft(null)}
        onConfirm={handleImportBackup}
      />
      <NavHistoryModal
        fund={selectedFund}
        modal={navModal}
        busy={busy.active}
        onClose={closeNavModal}
        onPrev={handlePrevNavPage}
        onNext={handleNextNavPage}
      />
      <AddFundModal
        open={addFundModalOpen}
        draft={assetDraft}
        busy={addingFundBusy}
        onDraftChange={setAssetDraft}
        onSubmit={handleAddFund}
        onClose={handleCloseAddFund}
      />
      <HiddenFundsModal
        open={hiddenFundsModalOpen}
        funds={hiddenFunds}
        loading={hiddenFundsLoading}
        busy={busy.active}
        onClose={handleCloseHiddenFunds}
        onPreview={handlePreviewHiddenFund}
        onRestore={handleRestoreFund}
      />
      <EditTradeModal
        fund={selectedFund}
        record={tradeForm.editingTrade}
        draft={tradeForm.editTradeDraft}
        busy={busy.active}
        onDraftChange={tradeForm.setEditTradeDraft}
        onSubmit={handleSubmitEditTrade}
        onClose={handleCloseEditTrade}
      />
    </>
  );
}
