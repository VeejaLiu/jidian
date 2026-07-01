import { useCallback, useEffect, useRef, useState } from "react";
import { AppDialogs } from "./components/AppDialogs";
import { AppMain } from "./components/AppMain";
import { useAccounts } from "./hooks/useAccounts";
import { useAppShortcuts } from "./hooks/useAppShortcuts";
import { useAssetActions } from "./hooks/useAssetActions";
import { useAssets } from "./hooks/useAssets";
import { useBackupImportExport } from "./hooks/useBackupImportExport";
import { useBusyAction } from "./hooks/useBusyAction";
import { useChartData } from "./hooks/useChartData";
import { useNavHistoryModal } from "./hooks/useNavHistoryModal";
import { usePendingTradesRefresh } from "./hooks/usePendingTradesRefresh";
import { useTradeActions } from "./hooks/useTradeActions";
import { useTradeForm } from "./hooks/useTradeForm";

export function App() {
  const { busy, runWithBusy } = useBusyAction();
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [addFundModalOpen, setAddFundModalOpen] = useState(false);
  const [hiddenFundsModalOpen, setHiddenFundsModalOpen] = useState(false);
  const [fundSearch, setFundSearch] = useState("");
  const [chartRefreshKey, setChartRefreshKey] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const refreshChart = useCallback(() => {
    setChartRefreshKey((key) => key + 1);
  }, []);

  const navHistory = useNavHistoryModal();
  const accounts = useAccounts({
    runWithBusy,
    onAccountCreated: () => {
      setFundSearch("");
      refreshChart();
    },
    onAccountDeleted: () => {
      setFundSearch("");
      refreshChart();
    },
  });
  const assets = useAssets({
    selectedAccountId: accounts.selectedAccountId,
    accountQuery: accounts.accountQuery,
    runWithBusy,
    loadAccountSummary: accounts.loadAccountSummary,
    refreshChart,
    closeNavModal: navHistory.closeNavModal,
    onAssetAdded: () => setAddFundModalOpen(false),
  });
  const tradeForm = useTradeForm(assets.selectedFund?.assetType);
  const chart = useChartData(assets.selectedFund?.id, accounts.accountQuery, chartRefreshKey);
  const assetActions = useAssetActions({
    selectedFund: assets.selectedFund,
    selectedAccountId: accounts.selectedAccountId,
    previewingHiddenFund: assets.previewingHiddenFund,
    setPreviewFund: assets.setPreviewFund,
    syncPreviewFund: assets.syncPreviewFund,
    loadFunds: assets.loadFunds,
    loadAccountSummary: accounts.loadAccountSummary,
    refreshChart,
    runWithBusy,
  });
  const tradeActions = useTradeActions({
    selectedFund: assets.selectedFund,
    selectedAccountId: accounts.selectedAccountId,
    previewingHiddenFund: assets.previewingHiddenFund,
    tradeForm,
    runWithBusy,
    loadFunds: assets.loadFunds,
    loadAccountSummary: accounts.loadAccountSummary,
    syncPreviewFund: assets.syncPreviewFund,
    refreshChart,
    busyActive: busy.active,
  });

  const reloadAfterImport = useCallback(async () => {
    assets.setPreviewFund(null);
    setFundSearch("");
    assets.setHiddenFunds([]);
    accounts.setAccountSummary(null);
    assets.setSelectedFundId(null);
    chart.setChartData({ nav: [], trades: [], position: null });
    const nextAccounts = await accounts.loadAccounts();
    const nextAccountId = nextAccounts[0]?.id ?? null;
    accounts.setSelectedAccountId(nextAccountId);
    await accounts.loadAccountSummary(nextAccountId);
    refreshChart();
  }, [
    accounts.loadAccountSummary,
    accounts.loadAccounts,
    accounts.setAccountSummary,
    accounts.setSelectedAccountId,
    assets.setHiddenFunds,
    assets.setPreviewFund,
    assets.setSelectedFundId,
    chart.setChartData,
    refreshChart,
  ]);

  const backup = useBackupImportExport({ runWithBusy, reloadAfterImport });

  useEffect(() => {
    if (!accounts.selectedAccountId) return;
    assets.resetAssets();
    assets.resetHiddenFunds();
    runWithBusy("加载中...", () => assets.loadFunds({ keepSelection: false }));
    accounts.loadAccountSummary();
  }, [
    accounts.loadAccountSummary,
    accounts.selectedAccountId,
    assets.loadFunds,
    assets.resetAssets,
    assets.resetHiddenFunds,
    runWithBusy,
  ]);

  usePendingTradesRefresh({
    selectedFund: assets.selectedFund,
    selectedFundId: assets.selectedFundId,
    loadFunds: assets.loadFunds,
    refreshChart,
  });
  useAppShortcuts({
    busy: busy.active,
    addingFundBusy: assets.addingFundBusy,
    selectedFund: assets.selectedFund,
    searchInputRef,
    onOpenAddFund: () => setAddFundModalOpen(true),
    onSyncNav: assetActions.handleSyncNav,
  });

  const handleSelectAccount = (accountId: number) => {
    accounts.setSelectedAccountId(accountId);
    assets.resetAssets();
    setFundSearch("");
    assets.resetHiddenFunds();
    setAccountModalOpen(false);
    accounts.loadAccountSummary(accountId);
    refreshChart();
  };

  const handleOpenHiddenFunds = () => {
    setHiddenFundsModalOpen(true);
    assets.loadHiddenFunds();
  };

  const handleCloseHiddenFunds = () => {
    if (busy.active) return;
    setHiddenFundsModalOpen(false);
  };

  const handlePreviewHiddenFund = (fund: typeof assets.hiddenFunds[number]) => {
    assets.handlePreviewHiddenFund(fund);
    setHiddenFundsModalOpen(false);
  };

  const handleRestoreFund = (fund: typeof assets.hiddenFunds[number]) => {
    assets.handleRestoreFund(fund, () => setHiddenFundsModalOpen(false));
  };

  const handleCloseAddFund = () => {
    if (assets.addingFundBusy) return;
    assets.setAssetDraft({ assetType: "fund", code: "", name: "" });
    setAddFundModalOpen(false);
  };

  return (
    <>
      <AppMain
        accounts={accounts}
        assets={assets}
        assetActions={assetActions}
        chart={chart}
        tradeActions={tradeActions}
        tradeForm={tradeForm}
        busy={busy}
        fundSearch={fundSearch}
        searchInputRef={searchInputRef}
        onSearchChange={setFundSearch}
        onOpenAddFund={() => setAddFundModalOpen(true)}
        onOpenHiddenFunds={handleOpenHiddenFunds}
        onOpenAccountModal={() => setAccountModalOpen(true)}
        onViewAllNav={navHistory.handleViewAllNav}
      />
      <AppDialogs
        accounts={accounts}
        assets={assets}
        backup={backup}
        navHistory={navHistory}
        tradeActions={tradeActions}
        tradeForm={tradeForm}
        busy={busy}
        accountModalOpen={accountModalOpen}
        addFundModalOpen={addFundModalOpen}
        hiddenFundsModalOpen={hiddenFundsModalOpen}
        onCloseAccountModal={() => setAccountModalOpen(false)}
        onSelectAccount={handleSelectAccount}
        onCloseAddFund={handleCloseAddFund}
        onCloseHiddenFunds={handleCloseHiddenFunds}
        onPreviewHiddenFund={handlePreviewHiddenFund}
        onRestoreFund={handleRestoreFund}
      />
    </>
  );
}
