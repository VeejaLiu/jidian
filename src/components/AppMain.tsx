import type { RefObject } from "react";
import { FundSidebar } from "./fund/FundSidebar";
import { Workspace } from "./Workspace";
import type { useAccounts } from "../hooks/useAccounts";
import type { useAssetActions } from "../hooks/useAssetActions";
import type { useAssets } from "../hooks/useAssets";
import type { useChartData } from "../hooks/useChartData";
import type { useTradeActions } from "../hooks/useTradeActions";
import type { useTradeForm } from "../hooks/useTradeForm";
import type { Fund } from "../types/fund";

interface AppMainProps {
  accounts: ReturnType<typeof useAccounts>;
  assets: ReturnType<typeof useAssets>;
  assetActions: ReturnType<typeof useAssetActions>;
  chart: ReturnType<typeof useChartData>;
  tradeActions: ReturnType<typeof useTradeActions>;
  tradeForm: ReturnType<typeof useTradeForm>;
  busy: { active: boolean; label: string };
  fundSearch: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onSearchChange: (value: string) => void;
  onOpenAddFund: () => void;
  onOpenHiddenFunds: () => void;
  onOpenAccountModal: () => void;
  onViewAllNav: (fund: Fund | null) => void;
}

export function AppMain({
  accounts,
  assets,
  assetActions,
  chart,
  tradeActions,
  tradeForm,
  busy,
  fundSearch,
  searchInputRef,
  onSearchChange,
  onOpenAddFund,
  onOpenHiddenFunds,
  onOpenAccountModal,
  onViewAllNav,
}: AppMainProps) {
  return (
    <main className="app-shell">
      <FundSidebar
        funds={assets.funds}
        selectedAccount={accounts.selectedAccount}
        selectedFundId={assets.previewingHiddenFund ? null : assets.selectedFundId}
        busy={busy.active}
        addingBusy={assets.addingFundBusy}
        searchValue={fundSearch}
        searchInputRef={searchInputRef}
        onSearchChange={onSearchChange}
        onOpenAddFund={onOpenAddFund}
        onOpenHiddenFunds={onOpenHiddenFunds}
        onOpenAccountModal={onOpenAccountModal}
        onSelectFund={assets.handleSelectVisibleFund}
      />
      <Workspace
        fund={assets.selectedFund}
        selectedAccount={accounts.selectedAccount}
        accountSummary={accounts.accountSummary}
        accountSummaryLoading={accounts.accountSummaryLoading}
        previewingHiddenFund={assets.previewingHiddenFund}
        busy={busy.active}
        busyLabel={busy.label}
        chartData={chart.chartData}
        chartLoading={chart.chartLoading}
        dropRateDraft={assetActions.dropRateDraft}
        manualPriceDraft={assetActions.manualPriceDraft}
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
        onHideFund={assets.handleHideFund}
        onSyncNav={assetActions.handleSyncNav}
        onDropRateDraftChange={assetActions.setDropRateDraft}
        onManualPriceDraftChange={assetActions.setManualPriceDraft}
        onSaveDropRate={assetActions.handleSaveDropRate}
        onSaveManualPrice={assetActions.handleSaveManualPrice}
        onViewAllNav={() => onViewAllNav(assets.selectedFund)}
        onSubmitTrade={tradeActions.handleSubmitTrade}
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
        onSubmitDividend={tradeActions.handleSubmitDividend}
        onEditTrade={tradeActions.handleEditTrade}
        onDeleteTrade={tradeActions.handleDeleteTrade}
        onUpdateDividend={tradeActions.handleUpdateDividend}
      />
    </main>
  );
}
