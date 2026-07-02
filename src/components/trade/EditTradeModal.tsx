import { useEffect, useRef, type FormEvent } from "react";
import { DatePicker } from "../DatePicker";
import type { Fund, NavPoint, TradeDraft, TradeRecord } from "../../types/fund";

interface EditTradeModalProps {
  fund: Fund | null;
  navPoints?: NavPoint[];
  record: TradeRecord | null;
  draft: TradeDraft;
  busy: boolean;
  onDraftChange: (draft: TradeDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function EditTradeModal({
  fund,
  navPoints = [],
  record,
  draft,
  busy,
  onDraftChange,
  onClose,
  onSubmit,
}: EditTradeModalProps) {
  const lastEditedFieldRef = useRef<"amount" | "shares">("shares");
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && record && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, record]);

  if (!record) return null;
  const isStock = fund?.assetType === "stock";
  const isFundSell = !isStock && draft.type === "sell";
  const availableShares = Number(fund?.position?.totalShares);
  const hasAvailableShares = Number.isFinite(availableShares) && availableShares > 0;
  const currentFee = Number(draft.fee || 0);
  const currentSellShares = Number(draft.shares);
  const selectedNavNumber = Number(navPoints.find((point) => point.date === draft.date)?.nav);
  const hasSelectedNav = Number.isFinite(selectedNavNumber) && selectedNavNumber > 0;
  const estimatedSellAmount = isFundSell
    && Number.isFinite(currentSellShares)
    && currentSellShares > 0
    && hasSelectedNav
    && Number.isFinite(currentFee)
    && currentFee >= 0
      ? (currentSellShares * selectedNavNumber) - currentFee
      : null;
  const hasSellAmountInput = Number.isFinite(Number(draft.amount)) && Number(draft.amount) > 0;
  const hasSellSharesInput = Number.isFinite(currentSellShares) && currentSellShares > 0;
  const quickShareOptions = [
    { label: "全部", ratio: 1 },
    { label: "1/2", ratio: 0.5 },
    { label: "1/4", ratio: 0.25 },
  ];

  const setDraftField = (field: keyof TradeDraft, value: string) => {
    onDraftChange({ ...draft, [field]: value });
  };

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
    onDraftChange({
      ...draft,
      amount: nextAmount,
      shares: calculateSharesFromAmount(nextAmount, draft.fee, getNavForDate(draft.date)),
    });
  }

  function handleFundSellSharesChange(nextShares: string) {
    lastEditedFieldRef.current = "shares";
    onDraftChange({
      ...draft,
      shares: nextShares,
      amount: calculateAmountFromShares(nextShares, draft.fee, getNavForDate(draft.date)),
    });
  }

  function handleFundSellDateChange(nextDate: string) {
    const nextNav = getNavForDate(nextDate);
    onDraftChange({
      ...draft,
      date: nextDate,
      amount: lastEditedFieldRef.current === "shares" ? calculateAmountFromShares(draft.shares, draft.fee, nextNav) : draft.amount,
      shares: lastEditedFieldRef.current === "amount" ? calculateSharesFromAmount(draft.amount, draft.fee, nextNav) : draft.shares,
    });
  }

  function handleFundSellFeeChange(nextFee: string) {
    const nextNav = getNavForDate(draft.date);
    onDraftChange({
      ...draft,
      fee: nextFee,
      amount: lastEditedFieldRef.current === "shares" ? calculateAmountFromShares(draft.shares, nextFee, nextNav) : draft.amount,
      shares: lastEditedFieldRef.current === "amount" ? calculateSharesFromAmount(draft.amount, nextFee, nextNav) : draft.shares,
    });
  }

  function renderFundSellFeedback() {
    if (!hasSellAmountInput && !hasSellSharesInput) {
      return (
        <div className="trade-sell-feedback">
          <strong>输入卖出金额或卖出份额后会自动换算</strong>
          <span>手续费会计入实际到账金额。</span>
        </div>
      );
    }

    if (!hasSelectedNav) {
      return (
        <div className="trade-sell-feedback pending">
          <strong>当天净值未找到</strong>
          <span>本次会先保存为待确认，后续自动补齐卖出净值和到账金额。</span>
        </div>
      );
    }

    if (estimatedSellAmount != null && estimatedSellAmount <= 0) {
      return (
        <div className="trade-sell-feedback danger">
          <strong>当前手续费已经覆盖本次卖出金额</strong>
          <span>请调低手续费，或提高卖出金额/卖出份额。</span>
        </div>
      );
    }

    return (
      <div className="trade-sell-feedback">
        <strong>按当日净值 {selectedNavNumber.toFixed(4)} 自动换算</strong>
        <span>
          卖出份额 {hasSellSharesInput ? formatShareInput(currentSellShares) : "--"} 份
          {" · "}
          预计到账 {estimatedSellAmount != null ? estimatedSellAmount.toFixed(2) : draft.amount || "--"}
        </span>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="editTradeModalTitle" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form className="modal-panel trade-edit-modal trade-entry-form" noValidate onSubmit={onSubmit}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">交易记录</p>
            <h2 id="editTradeModalTitle">编辑交易</h2>
          </div>
          <button className="icon-button light" type="button" aria-label="关闭" disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={`trade-type-switch trade-type-switch-animated ${draft.type === "buy" ? "is-buy" : "is-sell"}`} aria-label="交易类型">
          <button
            className={draft.type === "buy" ? "active" : ""}
            type="button"
            aria-pressed={draft.type === "buy"}
            disabled={busy}
            onClick={() => setDraftField("type", "buy")}
          >
            买入
          </button>
          <button
            className={draft.type === "sell" ? "active" : ""}
            type="button"
            aria-pressed={draft.type === "sell"}
            disabled={busy}
            onClick={() => setDraftField("type", "sell")}
          >
            卖出
          </button>
        </div>

        <div className="form-row compact">
          <label>
            <span>日期</span>
            <DatePicker value={draft.date} disabled={busy} onChange={(value) => (isFundSell ? handleFundSellDateChange(value) : setDraftField("date", value))} />
          </label>
        </div>

        {isFundSell ? (
          <div className="trade-sell-layout">
            <div className="form-row trade-sell-core-row">
              <label>
                <span>卖出金额</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.amount}
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
                  value={draft.shares}
                  onChange={(event) => handleFundSellSharesChange(event.target.value)}
                  disabled={busy}
                />
              </label>
            </div>
            <div className="form-row trade-sell-support-row">
              <label>
                <span>手续费</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.fee}
                  onChange={(event) => handleFundSellFeeChange(event.target.value)}
                  disabled={busy}
                />
              </label>
              <div className="trade-sell-assist">
                <div className="trade-sell-assist-meta">
                  <span>当前持有</span>
                  <strong>{hasAvailableShares ? `${formatShareInput(availableShares)} 份` : "--"}</strong>
                </div>
                <div className="trade-quick-sell-actions">
                  {quickShareOptions.map((option) => (
                    <button
                      key={option.label}
                      className="secondary-button"
                      type="button"
                      disabled={busy || !hasAvailableShares}
                      onClick={() => hasAvailableShares && handleFundSellSharesChange(formatShareInput(availableShares * option.ratio))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {renderFundSellFeedback()}
          </div>
        ) : (
          <div className="form-row compact">
            {isStock ? (
              <label>
                <span>{draft.type === "sell" ? "卖出价格" : "买入价格"}</span>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={draft.price}
                  onChange={(event) => setDraftField("price", event.target.value)}
                  disabled={busy}
                  required
                />
              </label>
            ) : (
              <label>
                <span>买入金额</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.amount}
                  onChange={(event) => setDraftField("amount", event.target.value)}
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
                value={draft.fee}
                onChange={(event) => setDraftField("fee", event.target.value)}
                disabled={busy}
              />
            </label>
          </div>
        )}

        {isStock && (
          <div className="form-row compact">
            <label>
              <span>{draft.type === "sell" ? "卖出股数" : "买入股数"}</span>
              <input
                type="number"
                min="0"
                step="1"
                value={draft.shares}
                onChange={(event) => setDraftField("shares", event.target.value)}
                disabled={busy}
                required
              />
            </label>
            <label>
              <span>成交金额</span>
              <input type="number" value={draft.amount} disabled readOnly />
            </label>
          </div>
        )}
        <label>
          <span>备注</span>
          <input
            value={draft.note}
            onChange={(event) => setDraftField("note", event.target.value)}
            disabled={busy}
          />
        </label>
        <p className="form-help">
          {isStock
            ? "股票交易按成交价、股数和税费保存，金额会自动计算并计入成本。"
            : isFundSell
              ? "基金卖出支持输入金额或份额，系统会按当日净值和手续费自动换算。"
              : "基金买入按实际支付金额保存；手续费会自动计入份额、成本和收益。"}
        </p>

        <div className="modal-actions">
          <button className="secondary-button neutral-button" type="button" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button className="secondary-button" type="submit" disabled={busy}>
            {busy ? "保存中..." : "保存修改"}
          </button>
        </div>
      </form>
    </div>
  );
}
