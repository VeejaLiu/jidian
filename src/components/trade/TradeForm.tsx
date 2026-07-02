import { useRef, type FormEvent } from "react";
import { DatePicker } from "../DatePicker";
import type { NavPoint, TradeType } from "../../types/fund";

interface TradeFormProps {
  busy: boolean;
  isStock?: boolean;
  availableShares?: number | null;
  navPoints?: NavPoint[];
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
  availableShares,
  navPoints = [],
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
  const lastEditedFieldRef = useRef<"amount" | "shares">("shares");
  const isFundSell = !isStock && tradeType === "sell";
  const currentShares = Number(availableShares);
  const currentFee = Number(tradeFee || 0);
  const currentSellShares = Number(tradeShares);
  const hasAvailableShares = Number.isFinite(currentShares) && currentShares > 0;
  const selectedNav = navPoints.find((point) => point.date === tradeDate)?.nav;
  const selectedNavNumber = Number(selectedNav);
  const estimatedSellAmount = isFundSell
    && Number.isFinite(currentSellShares)
    && currentSellShares > 0
    && Number.isFinite(selectedNavNumber)
    && selectedNavNumber > 0
    && Number.isFinite(currentFee)
    && currentFee >= 0
      ? (currentSellShares * selectedNavNumber) - currentFee
      : null;
  const quickShareOptions = [
    { label: "全部", ratio: 1 },
    { label: "1/2", ratio: 0.5 },
    { label: "1/4", ratio: 0.25 },
  ];

  function formatShareInput(value: number) {
    return value.toFixed(2).replace(/\.?0+$/, "");
  }

  function formatAmountInput(value: number) {
    return value.toFixed(2);
  }

  function getNavForDate(date: string) {
    const value = Number(navPoints.find((point) => point.date === date)?.nav);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function calculateAmountFromShares(sharesValue: string, feeValue: string, navValue: number | null) {
    const sharesNumber = Number(sharesValue);
    const feeNumber = Number(feeValue || 0);
    if (!Number.isFinite(sharesNumber) || sharesNumber <= 0 || !Number.isFinite(feeNumber) || feeNumber < 0 || !navValue) return "";
    const amount = (sharesNumber * navValue) - feeNumber;
    return amount > 0 ? formatAmountInput(amount) : "";
  }

  function calculateSharesFromAmount(amountValue: string, feeValue: string, navValue: number | null) {
    const amountNumber = Number(amountValue);
    const feeNumber = Number(feeValue || 0);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0 || !Number.isFinite(feeNumber) || feeNumber < 0 || !navValue) return "";
    const sharesNumber = (amountNumber + feeNumber) / navValue;
    return sharesNumber > 0 ? formatShareInput(sharesNumber) : "";
  }

  function handleFundSellAmountChange(nextAmount: string) {
    lastEditedFieldRef.current = "amount";
    onAmountChange(nextAmount);
    const nextShares = calculateSharesFromAmount(nextAmount, tradeFee, getNavForDate(tradeDate));
    onSharesChange(nextShares);
  }

  function handleFundSellSharesChange(nextShares: string) {
    lastEditedFieldRef.current = "shares";
    onSharesChange(nextShares);
    const nextAmount = calculateAmountFromShares(nextShares, tradeFee, getNavForDate(tradeDate));
    onAmountChange(nextAmount);
  }

  function handleFundSellDateChange(nextDate: string) {
    onDateChange(nextDate);
    const nextNav = getNavForDate(nextDate);
    if (lastEditedFieldRef.current === "amount") {
      onSharesChange(calculateSharesFromAmount(tradeAmount, tradeFee, nextNav));
      return;
    }
    onAmountChange(calculateAmountFromShares(tradeShares, tradeFee, nextNav));
  }

  function handleFundSellFeeChange(nextFee: string) {
    onFeeChange(nextFee);
    const nextNav = getNavForDate(tradeDate);
    if (lastEditedFieldRef.current === "amount") {
      onSharesChange(calculateSharesFromAmount(tradeAmount, nextFee, nextNav));
      return;
    }
    onAmountChange(calculateAmountFromShares(tradeShares, nextFee, nextNav));
  }

  return (
    <form className="data-form" noValidate onSubmit={onSubmit}>
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
          <DatePicker value={tradeDate} disabled={busy} onChange={isFundSell ? handleFundSellDateChange : onDateChange} />
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
        ) : isFundSell ? (
          <>
            <label>
              <span>卖出金额</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="例如：1000.00"
                value={tradeAmount}
                onChange={(event) => handleFundSellAmountChange(event.target.value)}
                disabled={busy}
              />
            </label>
            <label>
              <span>卖出份额</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="例如：500.00"
                value={tradeShares}
                onChange={(event) => handleFundSellSharesChange(event.target.value)}
                disabled={busy}
              />
            </label>
          </>
        ) : (
        <label>
          <span>买入金额</span>
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
        <label>
          <span>{isStock ? "税费" : "手续费"}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="例如：5.00"
            value={tradeFee}
            onChange={(event) => (isFundSell ? handleFundSellFeeChange(event.target.value) : onFeeChange(event.target.value))}
            disabled={busy}
          />
        </label>
      </div>
      {isFundSell && (
        <div className="trade-quick-sell">
          <div className="trade-quick-sell-meta">
            <span>当前持有 {hasAvailableShares ? formatShareInput(currentShares) : "--"} 份</span>
            <span>
              {estimatedSellAmount != null
                ? `按 ${selectedNavNumber.toFixed(4)} 净值预估到账 ${estimatedSellAmount.toFixed(2)}`
                : "当天净值未找到时会先显示待确认，后续自动补齐到账金额"}
            </span>
          </div>
          <div className="trade-quick-sell-actions">
            {quickShareOptions.map((option) => (
              <button
                key={option.label}
                className="secondary-button"
                type="button"
                disabled={busy || !hasAvailableShares}
                onClick={() => hasAvailableShares && handleFundSellSharesChange(formatShareInput(currentShares * option.ratio))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
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
          : isFundSell
            ? estimatedSellAmount != null && estimatedSellAmount <= 0
              ? "当前手续费已经大于等于本次卖出总额，请调整手续费或卖出份额。"
              : "基金卖出按份额记录；如果当天净值尚未公布，会先保存为待确认，后续自动补齐卖出净值和实际到账金额。"
            : "基金金额按实际现金流记录：买入填总支付；手续费会自动计入份额、成本和收益。若当天净值尚未公布，系统后续会自动补齐净值和份额。"}
      </p>
      <button type="submit" disabled={busy}>
        保存交易
      </button>
    </form>
  );
}
