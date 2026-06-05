import type { FormEvent } from "react";
import { DatePicker } from "../DatePicker";
import type { TradeType } from "../../types/fund";

interface TradeFormProps {
  busy: boolean;
  tradeType: TradeType;
  tradeDate: string;
  tradeAmount: string;
  tradeNote: string;
  onTypeChange: (type: TradeType) => void;
  onDateChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function TradeForm({
  busy,
  tradeType,
  tradeDate,
  tradeAmount,
  tradeNote,
  onTypeChange,
  onDateChange,
  onAmountChange,
  onNoteChange,
  onSubmit,
}: TradeFormProps) {
  return (
    <form className="data-form" onSubmit={onSubmit}>
      <h3>添加交易</h3>
      <div className="trade-type-switch" aria-label="交易类型">
        <button
          className={tradeType === "buy" ? "active" : ""}
          type="button"
          aria-pressed={tradeType === "buy"}
          disabled={busy}
          onClick={() => onTypeChange("buy")}
        >
          买入
        </button>
        <button
          className={tradeType === "sell" ? "active" : ""}
          type="button"
          aria-pressed={tradeType === "sell"}
          disabled={busy}
          onClick={() => onTypeChange("sell")}
        >
          卖出
        </button>
      </div>
      <div className="form-row compact">
        <label>
          <span>日期</span>
          <DatePicker value={tradeDate} disabled={busy} onChange={onDateChange} />
        </label>
        <label>
          <span>{tradeType === "sell" ? "卖出金额" : "买入金额"}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="例如：1000.00"
            value={tradeAmount}
            onChange={(event) => onAmountChange(event.target.value)}
            disabled={busy}
            required
          />
        </label>
      </div>
      <label>
        <span>备注</span>
        <input
          placeholder={tradeType === "sell" ? "可选，例如：止盈一部分" : "可选，例如：第 3 份"}
          value={tradeNote}
          onChange={(event) => onNoteChange(event.target.value)}
          disabled={busy}
        />
      </label>
      <p className="form-help">
        若当天净值尚未公布，交易会先保存为待确认；系统同步到该日净值后会自动补齐净值和份额。
      </p>
      <button type="submit" disabled={busy}>
        保存交易
      </button>
    </form>
  );
}
