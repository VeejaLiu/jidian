import { useState, type FormEvent } from "react";
import { NavChart } from "./chart/NavChart";
import { FundActionMenu, type FundAction } from "./fund/FundActionMenu";
import { FundActionModal } from "./fund/FundActionModal";
import { SummaryCards } from "./fund/SummaryCards";
import { TradeSection } from "./trade/TradeSection";
import type { ChartData, Fund, TradeRecord, TradeType } from "../types/fund";
import { formatDateTime, formatNav } from "../utils/format";

interface WorkspaceProps {
  fund: Fund | null;
  busy: boolean;
  busyLabel: string;
  chartData: ChartData;
  chartLoading: boolean;
  dropRateDraft: string;
  tradeType: TradeType;
  tradeDate: string;
  tradeAmount: string;
  tradeNote: string;
  onHideFund: () => boolean | Promise<boolean>;
  onSyncNav: () => boolean | Promise<boolean>;
  onDropRateDraftChange: (value: string) => void;
  onSaveDropRate: () => boolean | Promise<boolean>;
  onViewAllNav: () => void;
  onSubmitTrade: (event: FormEvent<HTMLFormElement>) => void;
  onTradeTypeChange: (type: TradeType) => void;
  onTradeDateChange: (value: string) => void;
  onTradeAmountChange: (value: string) => void;
  onTradeNoteChange: (value: string) => void;
  onEditTrade: (record: TradeRecord) => void;
  onDeleteTrade: (record: TradeRecord) => void;
}

export function Workspace({
  fund,
  busy,
  busyLabel,
  chartData,
  chartLoading,
  dropRateDraft,
  tradeType,
  tradeDate,
  tradeAmount,
  tradeNote,
  onHideFund,
  onSyncNav,
  onDropRateDraftChange,
  onSaveDropRate,
  onViewAllNav,
  onSubmitTrade,
  onTradeTypeChange,
  onTradeDateChange,
  onTradeAmountChange,
  onTradeNoteChange,
  onEditTrade,
  onDeleteTrade,
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
        <div className="empty-state">
          <h2>先添加一只基金</h2>
          <p>输入基金代码后会自动同步历史净值。添加交易后，这里会算出今日需要下跌多少才买入一份。</p>
        </div>
      ) : (
        <div className="fund-workspace">
          <header className="workspace-header">
            <div>
              <p className="eyebrow">{[fund.code, fund.fundType].filter(Boolean).join(" / ") || "未填写代码"}</p>
              <h2>{fund.name}</h2>
              <div className="fund-header-meta" aria-label="净值更新状态">
                <span>最新净值 {fund.status?.latestNavDate || "--"} / {formatNav(fund.status?.latestNav)}</span>
                <span>上次更新 {formatDateTime(fund.lastNavSyncAt)}</span>
              </div>
            </div>
            <FundActionMenu busy={busy} onSelect={openFundAction} />
          </header>

          <FundActionModal
            action={fundAction}
            fund={fund}
            busy={busy}
            dropRateDraft={dropRateDraft}
            onDropRateDraftChange={onDropRateDraftChange}
            onClose={closeFundAction}
            onConfirmDropRate={onSaveDropRate}
            onConfirmSyncNav={onSyncNav}
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
            busy={busy}
            tradeType={tradeType}
            tradeDate={tradeDate}
            tradeAmount={tradeAmount}
            tradeNote={tradeNote}
            onTypeChange={onTradeTypeChange}
            onDateChange={onTradeDateChange}
            onAmountChange={onTradeAmountChange}
            onNoteChange={onTradeNoteChange}
            onSubmit={onSubmitTrade}
            onEditTrade={onEditTrade}
            onDeleteTrade={onDeleteTrade}
          />
        </div>
      )}
    </section>
  );
}
