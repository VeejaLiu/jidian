import type { FormEvent } from "react";
import { DatePicker } from "../DatePicker";
import type { TradeType } from "../../types/fund";

interface TradeFormProps {
  busy: boolean;
  isStock?: boolean;
  tradeType: TradeType;
  tradeDate: string;
  tradeAmount: string;
  tradePrice: string;
  tradeShares: string;
  tradeFee: string;
  tradeNote: string;
  onTypeChange: (type: TradeType) => void;
  onDateChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onSharesChange: (value: string) => void;
  onFeeChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function TradeForm({
  busy,
  isStock = false,
  tradeType,
  tradeDate,
  tradeAmount,
  tradePrice,
  tradeShares,
  tradeFee,
  tradeNote,
  onTypeChange,
  onDateChange,
  onAmountChange,
  onPriceChange,
  onSharesChange,
  onFeeChange,
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
        {isStock ? (
          <label>
            <span>{tradeType === "sell" ? "卖出价格" : "买入价格"}</span>
            <input
              type="number"
              min="0"
              step="0.0001"
              placeholder="例如：12.3400"
              value={tradePrice}
              onChange={(event) => onPriceChange(event.target.value)}
              disabled={busy}
              required
            />
          </label>
        ) : (
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
        )}
      </div>
      {isStock && (
        <div className="form-row compact">
          <label>
            <span>{tradeType === "sell" ? "卖出股数" : "买入股数"}</span>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="例如：100"
              value={tradeShares}
              onChange={(event) => onSharesChange(event.target.value)}
              disabled={busy}
              required
            />
          </label>
          <label>
            <span>税费</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="例如：5.00"
              value={tradeFee}
              onChange={(event) => onFeeChange(event.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            <span>成交金额</span>
            <input type="number" value={tradeAmount} disabled readOnly />
          </label>
        </div>
      )}
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
        {isStock
          ? "股票手动交易按成交价、股数和税费记录，成交金额会自动计算并计入成本。"
          : "若当天净值尚未公布，交易会先保存为待确认；系统同步到该日净值后会自动补齐净值和份额。"}
      </p>
      <button type="submit" disabled={busy}>
        保存交易
      </button>
    </form>
  );
}
