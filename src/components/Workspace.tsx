import type { FormEvent } from "react";
import { NavChart } from "./chart/NavChart";
import { SummaryCards } from "./fund/SummaryCards";
import { TradeSection } from "./trade/TradeSection";
import type { ChartData, Fund, TradeRecord, TradeType } from "../types/fund";

interface WorkspaceProps {
  fund: Fund | null;
  busy: boolean;
  busyLabel: string;
  chartData: ChartData;
  chartLoading: boolean;
  tradeType: TradeType;
  tradeDate: string;
  tradeAmount: string;
  tradeNote: string;
  onHideFund: () => void;
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
  tradeType,
  tradeDate,
  tradeAmount,
  tradeNote,
  onHideFund,
  onViewAllNav,
  onSubmitTrade,
  onTradeTypeChange,
  onTradeDateChange,
  onTradeAmountChange,
  onTradeNoteChange,
  onEditTrade,
  onDeleteTrade,
}: WorkspaceProps) {
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
            </div>
            <button className="danger-link" type="button" disabled={busy} onClick={onHideFund}>
              隐藏基金
            </button>
          </header>

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
