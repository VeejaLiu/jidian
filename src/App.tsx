import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AccountModal } from "./components/account/AccountModal";
import { AddFundModal } from "./components/fund/AddFundModal";
import { FundSidebar } from "./components/fund/FundSidebar";
import { HiddenFundsModal } from "./components/fund/HiddenFundsModal";
import { NavHistoryModal, type NavModalState } from "./components/nav/NavHistoryModal";
import { EditTradeModal, type EditTradeDraft } from "./components/trade/EditTradeModal";
import { Workspace } from "./components/Workspace";
import { api } from "./api/client";
import { DEFAULT_BUSY_LABEL, MIN_NAV_MODAL_LOADING_MS } from "./constants/app";
import type { ChartData, Fund, NavHistoryPage, TradeRecord, TradeType, UserAccount } from "./types/fund";
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
  const [fundCode, setFundCode] = useState("");
  const [fundSearch, setFundSearch] = useState("");
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [addFundModalOpen, setAddFundModalOpen] = useState(false);
  const [addingFundBusy, setAddingFundBusy] = useState(false);
  const [hiddenFundsModalOpen, setHiddenFundsModalOpen] = useState(false);
  const [hiddenFunds, setHiddenFunds] = useState<Fund[]>([]);
  const [hiddenFundsLoading, setHiddenFundsLoading] = useState(false);
  const [tradeType, setTradeType] = useState<TradeType>("buy");
  const [tradeDate, setTradeDate] = useState(todayISO());
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradeNote, setTradeNote] = useState("");
  const [editingTrade, setEditingTrade] = useState<TradeRecord | null>(null);
  const [editTradeDraft, setEditTradeDraft] = useState<EditTradeDraft>({
    type: "buy",
    date: todayISO(),
    amount: "",
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

  const selectedFund = useMemo(
    () => funds.find((fund) => fund.id === selectedFundId) || null,
    [funds, selectedFundId],
  );
  const hasPendingTrades = useMemo(
    () => Boolean(selectedFund?.trades?.some((trade) => trade.status === "pending")),
    [selectedFund],
  );
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) || null,
    [accounts, selectedAccountId],
  );

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
    const payload = await api<{ funds: Fund[] }>(`/api/funds?${accountQuery()}`);
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
        api<NavHistoryPage>(`/api/funds/${fundId}/nav?${params.toString()}`),
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
      const payload = await api<{ funds: Fund[] }>(`/api/hidden-funds?${accountQuery()}`);
      setHiddenFunds(payload.funds || []);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
    } finally {
      setHiddenFundsLoading(false);
    }
  }, [accountQuery, selectedAccountId]);

  useEffect(() => {
    runWithBusy("加载中...", loadAccounts);
  }, [loadAccounts, runWithBusy]);

  useEffect(() => {
    if (!selectedAccountId) return;
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
      if (!selectedFundId) {
        setChartData({ nav: [], trades: [], position: null });
        return;
      }

      setChartLoading(true);
      setChartData({ nav: [], trades: [], position: null });
      try {
        const payload = await api<ChartData>(`/api/funds/${selectedFundId}/chart?${accountQuery()}`);
        if (!cancelled) {
          setChartData({
            nav: payload.nav || [],
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
  }, [accountQuery, selectedFundId, chartRefreshKey]);

  const handleAddFund = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = fundCode.trim();
    if (!code || addingFundBusy) return;

    async function addFund() {
      setAddingFundBusy(true);
      try {
        const payload = await api<{ fund: Fund }>("/api/funds", {
          method: "POST",
          body: JSON.stringify({ code, accountId: selectedAccountId }),
        });
        const fundId = payload.fund.id;
        setSelectedFundId(fundId);
        setFundCode("");
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
    setFundCode("");
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
          note: tradeNote.trim(),
        }),
      });
      setTradeAmount("");
      setTradeNote("");
      await loadFunds({ preferredId: selectedFund.id });
      setChartRefreshKey((key) => key + 1);
    });
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
          note: editTradeDraft.note.trim(),
        }),
      });
      setEditingTrade(null);
      await loadFunds({ preferredId: selectedFund.id });
      setChartRefreshKey((key) => key + 1);
    });
  };

  const handleDeleteTrade = (record: TradeRecord) => {
    if (!selectedFund) return;
    const label = tradeTypeLabel(record.type);
    const confirmed = window.confirm(
      `确定删除这条${label}记录吗？\n日期：${record.date}\n金额：${formatMoney(record.amount)}\n份额：${formatShares(record.shares)}`,
    );
    if (!confirmed) return;

    runWithBusy("删除中...", async () => {
      await api(`/api/trades/${record.id}`, { method: "DELETE" });
      await loadFunds({ preferredId: selectedFund.id });
      setChartRefreshKey((key) => key + 1);
    });
  };

  const handleHideFund = () => {
    if (!selectedFund) return;
    const confirmed = window.confirm(`确定隐藏「${selectedFund.name}」吗？交易记录和历史净值都会保留。`);
    if (!confirmed) return;

    runWithBusy("隐藏中...", async () => {
      await api(`/api/funds/${selectedFund.id}?${accountQuery()}`, { method: "DELETE" });
      await loadFunds({ keepSelection: false });
      setNavModal((current) => ({ ...current, open: false }));
      setChartRefreshKey((key) => key + 1);
    });
  };

  const handleRestoreFund = (fund: Fund) => {
    runWithBusy("恢复中...", async () => {
      await api(`/api/funds/${fund.id}/restore?${accountQuery()}`, { method: "POST" });
      await loadFunds({ preferredId: fund.id });
      await loadHiddenFunds();
      setHiddenFundsModalOpen(false);
      setChartRefreshKey((key) => key + 1);
    });
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
          selectedFundId={selectedFundId}
          busy={busy.active}
          addingBusy={addingFundBusy}
          searchValue={fundSearch}
          onSearchChange={setFundSearch}
          onOpenAddFund={handleOpenAddFund}
          onOpenHiddenFunds={handleOpenHiddenFunds}
          onOpenAccountModal={() => setAccountModalOpen(true)}
          onSelectFund={setSelectedFundId}
        />
        <Workspace
          fund={selectedFund}
          busy={busy.active}
          busyLabel={busy.label}
          chartData={chartData}
          chartLoading={chartLoading}
          tradeType={tradeType}
          tradeDate={tradeDate}
          tradeAmount={tradeAmount}
          tradeNote={tradeNote}
          onHideFund={handleHideFund}
          onViewAllNav={handleViewAllNav}
          onSubmitTrade={handleSubmitTrade}
          onTradeTypeChange={setTradeType}
          onTradeDateChange={setTradeDate}
          onTradeAmountChange={setTradeAmount}
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
        fundCode={fundCode}
        busy={addingFundBusy}
        onFundCodeChange={setFundCode}
        onSubmit={handleAddFund}
        onClose={handleCloseAddFund}
      />
      <HiddenFundsModal
        open={hiddenFundsModalOpen}
        funds={hiddenFunds}
        loading={hiddenFundsLoading}
        busy={busy.active}
        onClose={handleCloseHiddenFunds}
        onRestore={handleRestoreFund}
      />
      <EditTradeModal
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
