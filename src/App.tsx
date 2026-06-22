import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AccountModal } from "./components/account/AccountModal";
import { AddFundModal } from "./components/fund/AddFundModal";
import { FundSidebar } from "./components/fund/FundSidebar";
import { HiddenFundsModal } from "./components/fund/HiddenFundsModal";
import { NavHistoryModal, type NavModalState } from "./components/nav/NavHistoryModal";
import { EditTradeModal } from "./components/trade/EditTradeModal";
import { Workspace } from "./components/Workspace";
import { api } from "./api/client";
import { DEFAULT_BUSY_LABEL, MIN_NAV_MODAL_LOADING_MS } from "./constants/app";
import type { AssetDraft, ChartData, Fund, NavHistoryPage, TradeDraft, TradeRecord, TradeType, UserAccount } from "./types/fund";
import { todayISO } from "./utils/date";
import { formatMoney, formatShares, tradeTypeLabel } from "./utils/format";

interface BusyState {
  active: boolean;
  label: string;
}

export function App() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
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
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [addFundModalOpen, setAddFundModalOpen] = useState(false);
  const [addingFundBusy, setAddingFundBusy] = useState(false);
  const [hiddenFundsModalOpen, setHiddenFundsModalOpen] = useState(false);
  const [hiddenFunds, setHiddenFunds] = useState<Fund[]>([]);
  const [hiddenFundsLoading, setHiddenFundsLoading] = useState(false);
  const [previewFund, setPreviewFund] = useState<Fund | null>(null);
  const [tradeType, setTradeType] = useState<TradeType>("buy");
  const [tradeDate, setTradeDate] = useState(todayISO());
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeShares, setTradeShares] = useState("");
  const [tradeFee, setTradeFee] = useState("");
  const [tradeNote, setTradeNote] = useState("");
  const [editingTrade, setEditingTrade] = useState<TradeRecord | null>(null);
  const [editTradeDraft, setEditTradeDraft] = useState<TradeDraft>({
    type: "buy",
    date: todayISO(),
    amount: "",
    price: "",
    shares: "",
    fee: "",
    note: "",
  });
  const [chartData, setChartData] = useState<ChartData>({ nav: [], trades: [], position: null });
  const [chartLoading, setChartLoading] = useState(false);
  const [chartRefreshKey, setChartRefreshKey] = useState(0);
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

  useEffect(() => {
    if (!isStock) return;
    const price = Number(tradePrice);
    const shares = Number(tradeShares);
    const fee = Number(tradeFee || 0);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(fee) || fee < 0) {
      setTradeAmount("");
      return;
    }
    const gross = price * shares;
    const nextAmount = tradeType === "buy" ? gross + fee : gross - fee;
    setTradeAmount(nextAmount > 0 ? nextAmount.toFixed(2) : "");
  }, [isStock, tradeFee, tradePrice, tradeShares, tradeType]);

  useEffect(() => {
    if (!editingTrade || selectedFund?.assetType !== "stock") return;
    const price = Number(editTradeDraft.price);
    const shares = Number(editTradeDraft.shares);
    const fee = Number(editTradeDraft.fee || 0);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(fee) || fee < 0) {
      setEditTradeDraft((current) => ({ ...current, amount: "" }));
      return;
    }
    const gross = price * shares;
    const nextAmountValue = editTradeDraft.type === "buy" ? gross + fee : gross - fee;
    const nextAmount = nextAmountValue > 0 ? nextAmountValue.toFixed(2) : "";
    setEditTradeDraft((current) => (current.amount === nextAmount ? current : { ...current, amount: nextAmount }));
  }, [editTradeDraft.fee, editTradeDraft.price, editTradeDraft.shares, editTradeDraft.type, editingTrade, selectedFund?.assetType]);

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
  }, [loadFunds, runWithBusy, selectedAccountId]);

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

  useEffect(() => {
    let cancelled = false;

    async function loadChart() {
      if (!selectedFund?.id) {
        setChartData({ nav: [], trades: [], position: null });
        return;
      }

      setChartLoading(true);
      setChartData({ nav: [], trades: [], position: null });
      try {
        const payload = await api<ChartData>(`/api/assets/${selectedFund.id}/chart?${accountQuery()}`);
        if (!cancelled) {
          setChartData({
            nav: payload.prices || payload.nav || [],
            trades: payload.trades || payload.buys || [],
            position: payload.position || null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setChartData({ nav: [], trades: [], position: null });
          window.alert(error instanceof Error ? error.message : "操作失败");
        }
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    }

    loadChart();
    return () => {
      cancelled = true;
    };
  }, [accountQuery, chartRefreshKey, selectedFund?.id]);

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
    setChartRefreshKey((key) => key + 1);
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
          type: tradeType,
          date: tradeDate,
          amount: tradeAmount,
          nav: isStock ? tradePrice : undefined,
          shares: isStock ? tradeShares : undefined,
          fee: isStock ? tradeFee : undefined,
          note: tradeNote.trim(),
        }),
      });
      setTradeAmount("");
      setTradePrice("");
      setTradeShares("");
      setTradeFee("");
      setTradeNote("");
      if (previewingHiddenFund) {
        await syncPreviewFund(selectedFund.id);
      } else {
        await loadFunds({ preferredId: selectedFund.id });
      }
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
    setEditingTrade(record);
    setEditTradeDraft({
      type: record.type,
      date: record.date,
      amount: String(record.amount ?? ""),
      price: String(record.nav ?? ""),
      shares: String(record.shares ?? ""),
      fee: String(record.fee ?? ""),
      note: record.note || "",
    });
  };

  const handleCloseEditTrade = () => {
    if (busy.active) return;
    setEditingTrade(null);
  };

  const handleSubmitEditTrade = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFund || !editingTrade) return;

    runWithBusy("保存中...", async () => {
      await api(`/api/trades/${editingTrade.id}`, {
        method: "PUT",
        body: JSON.stringify({
          type: editTradeDraft.type,
          date: editTradeDraft.date,
          amount: editTradeDraft.amount,
          nav: selectedFund?.assetType === "stock" ? editTradeDraft.price : undefined,
          shares: selectedFund?.assetType === "stock" ? editTradeDraft.shares : undefined,
          fee: selectedFund?.assetType === "stock" ? editTradeDraft.fee : undefined,
          note: editTradeDraft.note.trim(),
        }),
      });
      setEditingTrade(null);
      if (previewingHiddenFund) {
        await syncPreviewFund(selectedFund.id);
      } else {
        await loadFunds({ preferredId: selectedFund.id });
      }
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
          onSearchChange={setFundSearch}
          onOpenAddFund={handleOpenAddFund}
          onOpenHiddenFunds={handleOpenHiddenFunds}
          onOpenAccountModal={() => setAccountModalOpen(true)}
          onSelectFund={handleSelectVisibleFund}
        />
        <Workspace
          fund={selectedFund}
          previewingHiddenFund={previewingHiddenFund}
          busy={busy.active}
          busyLabel={busy.label}
          chartData={chartData}
          chartLoading={chartLoading}
          dropRateDraft={dropRateDraft}
          tradeType={tradeType}
          tradeDate={tradeDate}
          tradeAmount={tradeAmount}
          tradePrice={tradePrice}
          tradeShares={tradeShares}
          tradeFee={tradeFee}
          tradeNote={tradeNote}
          onHideFund={handleHideFund}
          onSyncNav={handleSyncNav}
          onDropRateDraftChange={setDropRateDraft}
          onSaveDropRate={handleSaveDropRate}
          onViewAllNav={handleViewAllNav}
          onSubmitTrade={handleSubmitTrade}
          onTradeTypeChange={setTradeType}
          onTradeDateChange={setTradeDate}
          onTradeAmountChange={setTradeAmount}
          onTradePriceChange={setTradePrice}
          onTradeSharesChange={setTradeShares}
          onTradeFeeChange={setTradeFee}
          onTradeNoteChange={setTradeNote}
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
        record={editingTrade}
        draft={editTradeDraft}
        busy={busy.active}
        onDraftChange={setEditTradeDraft}
        onSubmit={handleSubmitEditTrade}
        onClose={handleCloseEditTrade}
      />
    </>
  );
}
