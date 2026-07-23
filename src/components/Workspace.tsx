import { useState, type FormEvent } from "react";
import { NavChart } from "./chart/NavChart";
import { AccountOverview } from "./account/AccountOverview";
import { FundActionMenu, type FundAction } from "./fund/FundActionMenu";
import { FundActionModal } from "./fund/FundActionModal";
import { SummaryCards } from "./fund/SummaryCards";
import { TradeSection } from "./trade/TradeSection";
import type { AccountSummary, ChartData, DividendRecord, Fund, TradeRecord, TradeType, UserAccount } from "../types/fund";
import type { DividendDraft } from "./trade/EditDividendModal";
import { formatDateTime, formatNav } from "../utils/format";

interface WorkspaceProps {
  fund: Fund | null;
  selectedAccount: UserAccount | null;
  accountSummary: AccountSummary | null;
  accountSummaryLoading: boolean;
  previewingHiddenFund?: boolean;
  busy: boolean;
  busyLabel: string;
  chartData: ChartData;
  chartLoading: boolean;
  dropRateDraft: string;
  manualPriceDraft: { date: string; price: string; accumulatedNav: string };
  tradeType: TradeType;
  tradeDate: string;
  tradeAmount: string;
  tradePrice: string;
  tradeShares: string;
  tradeFee: string;
  tradeNote: string;
  dividendType: import("../types/fund").DividendType;
  dividendDate: string;
  dividendAmount: string;
  dividendNav: string;
  dividendShares: string;
  dividendNote: string;
  onHideFund: () => boolean | Promise<boolean>;
  onSyncNav: () => boolean | Promise<boolean>;
  onDropRateDraftChange: (value: string) => void;
  onManualPriceDraftChange: (draft: { date: string; price: string; accumulatedNav: string }) => void;
  onSaveDropRate: () => boolean | Promise<boolean>;
  onSaveManualPrice: () => boolean | Promise<boolean>;
  onViewAllNav: () => void;
  onSubmitTrade: (event: FormEvent<HTMLFormElement>) => void;
  onTradeTypeChange: (type: TradeType) => void;
  onTradeDateChange: (value: string) => void;
  onTradeAmountChange: (value: string) => void;
  onTradePriceChange: (value: string) => void;
  onTradeSharesChange: (value: string) => void;
  onTradeFeeChange: (value: string) => void;
  onTradeNoteChange: (value: string) => void;
  onDividendTypeChange: (type: import("../types/fund").DividendType) => void;
  onDividendDateChange: (value: string) => void;
  onDividendAmountChange: (value: string) => void;
  onDividendNavChange: (value: string) => void;
  onDividendSharesChange: (value: string) => void;
  onDividendNoteChange: (value: string) => void;
  onSubmitDividend: (event: FormEvent<HTMLFormElement>) => void;
  onEditTrade: (record: TradeRecord) => void;
  onDeleteTrade: (record: TradeRecord) => void;
  onUpdateDividend: (record: DividendRecord, draft: DividendDraft) => void;
}

export function Workspace({
  fund,
  selectedAccount,
  accountSummary,
  accountSummaryLoading,
  previewingHiddenFund = false,
  busy,
  busyLabel,
  chartData,
  chartLoading,
  dropRateDraft,
  manualPriceDraft,
  tradeType,
  tradeDate,
  tradeAmount,
  tradePrice,
  tradeShares,
  tradeFee,
  tradeNote,
  dividendType,
  dividendDate,
  dividendAmount,
  dividendNav,
  dividendShares,
  dividendNote,
  onHideFund,
  onSyncNav,
  onDropRateDraftChange,
  onManualPriceDraftChange,
  onSaveDropRate,
  onSaveManualPrice,
  onViewAllNav,
  onSubmitTrade,
  onTradeTypeChange,
  onTradeDateChange,
  onTradeAmountChange,
  onTradePriceChange,
  onTradeSharesChange,
  onTradeFeeChange,
  onTradeNoteChange,
  onDividendTypeChange,
  onDividendDateChange,
  onDividendAmountChange,
  onDividendNavChange,
  onDividendSharesChange,
  onDividendNoteChange,
  onSubmitDividend,
  onEditTrade,
  onDeleteTrade,
  onUpdateDividend,
}: WorkspaceProps) {
  const [fundAction, setFundAction] = useState<FundAction | null>(null);
  const currentDropRatePercent = ((Number(fund?.dropRate) || 0.04) * 100).toFixed(1);

  const openFundAction = (action: FundAction) => {
    if (action === "dropRate") onDropRateDraftChange(currentDropRatePercent);
    setFundAction(action);
  };

  const closeFundAction = () => {
    setFundAction(null);
  };

  return (
    <section className="workspace" aria-live="polite">
      {busy && (
        <div className="workspace-loading" aria-live="polite" aria-busy="true">
          <div className="spinner" aria-hidden="true"></div>
          <strong>{busyLabel}</strong>
        </div>
      )}

      {!fund ? (
        <>
          <AccountOverview account={selectedAccount} summary={accountSummary} loading={accountSummaryLoading} />
          <div className="empty-state">
            <h2>先添加基金，或导入股票交易</h2>
            <p>基金支持自动同步历史净值；股票支持批量导入买卖记录并计算持仓、成本和已实现盈亏。</p>
          </div>
        </>
      ) : (
        <div className="fund-workspace">
          <AccountOverview account={selectedAccount} summary={accountSummary} loading={accountSummaryLoading} />
          <header className="workspace-header">
            <div>
              <p className="eyebrow">{[fund.assetType === "stock" ? "股票" : "基金", fund.code, fund.fundType].filter(Boolean).join(" / ") || "未填写代码"}</p>
              <h2>{fund.name}</h2>
              <div className="fund-header-meta" aria-label="净值更新状态">
                <span>{fund.assetType === "stock" ? "最新价格" : "最新净值"} {fund.status?.latestPriceDate || fund.status?.latestNavDate || "--"} / {formatNav(fund.status?.latestPrice ?? fund.status?.latestNav)}</span>
                <span>上次更新 {formatDateTime(fund.lastPriceSyncAt || fund.lastNavSyncAt)}</span>
                <span>{formatSyncStatus(fund)}</span>
                {previewingHiddenFund && <span>当前为隐藏资产预览</span>}
              </div>
            </div>
            <FundActionMenu fund={fund} busy={busy} onSelect={openFundAction} />
          </header>

          <FundActionModal
            action={fundAction}
            fund={fund}
            busy={busy}
            dropRateDraft={dropRateDraft}
            manualPriceDraft={manualPriceDraft}
            onDropRateDraftChange={onDropRateDraftChange}
            onManualPriceDraftChange={onManualPriceDraftChange}
            onClose={closeFundAction}
            onConfirmDropRate={onSaveDropRate}
            onConfirmSyncNav={onSyncNav}
            onConfirmManualPrice={onSaveManualPrice}
            onConfirmHideFund={onHideFund}
          />

          <SummaryCards fund={fund} />
          <NavChart
            fund={fund}
            data={chartData}
            loading={chartLoading}
            busy={busy}
            onViewAllNav={onViewAllNav}
          />
          <TradeSection
            fund={fund}
            chartData={chartData}
            busy={busy}
            tradeType={tradeType}
            tradeDate={tradeDate}
            tradeAmount={tradeAmount}
            tradePrice={tradePrice}
            tradeShares={tradeShares}
            tradeFee={tradeFee}
            tradeNote={tradeNote}
            dividendType={dividendType}
            dividendDate={dividendDate}
            dividendAmount={dividendAmount}
            dividendNav={dividendNav}
            dividendShares={dividendShares}
            dividendNote={dividendNote}
            onTypeChange={onTradeTypeChange}
            onDateChange={onTradeDateChange}
            onAmountChange={onTradeAmountChange}
            onPriceChange={onTradePriceChange}
            onSharesChange={onTradeSharesChange}
            onFeeChange={onTradeFeeChange}
            onNoteChange={onTradeNoteChange}
            onSubmit={onSubmitTrade}
            onDividendTypeChange={onDividendTypeChange}
            onDividendDateChange={onDividendDateChange}
            onDividendAmountChange={onDividendAmountChange}
            onDividendNavChange={onDividendNavChange}
            onDividendSharesChange={onDividendSharesChange}
            onDividendNoteChange={onDividendNoteChange}
            onDividendSubmit={onSubmitDividend}
            onEditTrade={onEditTrade}
            onDeleteTrade={onDeleteTrade}
            onUpdateDividend={onUpdateDividend}
          />
        </div>
      )}
    </section>
  );
}

function formatSyncStatus(fund: Fund) {
  const status = fund.syncStatus;
  if (!status) return "后台同步 --";
  if (status.syncing) return "正在后台同步";
  if (status.reason === "throttled" && status.nextSyncAt) {
    return `下次检查 ${formatDateTime(new Date(status.nextSyncAt).toISOString())}`;
  }
  if (status.hasPendingTrade) return "待确认交易 5 分钟检查";
  return "后台同步 6 小时检查";
}
