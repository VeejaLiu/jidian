import { useEffect, type FormEvent } from "react";
import { DatePicker } from "../DatePicker";
import type { Fund, TradeDraft, TradeRecord } from "../../types/fund";

interface EditTradeModalProps {
  fund: Fund | null;
  record: TradeRecord | null;
  draft: TradeDraft;
  busy: boolean;
  onDraftChange: (draft: TradeDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function EditTradeModal({
  fund,
  record,
  draft,
  busy,
  onDraftChange,
  onClose,
  onSubmit,
}: EditTradeModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && record && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, record]);

  if (!record) return null;
  const isStock = fund?.assetType === "stock";

  const setDraftField = (field: keyof TradeDraft, value: string) => {
    onDraftChange({ ...draft, [field]: value });
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="editTradeModalTitle" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form className="modal-panel trade-edit-modal" onSubmit={onSubmit}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">交易记录</p>
            <h2 id="editTradeModalTitle">编辑交易</h2>
          </div>
          <button className="icon-button light" type="button" aria-label="关闭" disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="trade-type-switch" aria-label="交易类型">
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
            <DatePicker value={draft.date} disabled={busy} onChange={(value) => setDraftField("date", value)} />
          </label>
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
            <span>{draft.type === "sell" ? "卖出金额" : "买入金额"}</span>
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
        </div>

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
              <span>税费</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.fee}
                onChange={(event) => setDraftField("fee", event.target.value)}
                disabled={busy}
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
          {isStock ? "股票交易按成交价、股数和税费保存，金额会自动计算并计入成本。" : "若所选日期的净值尚未公布，保存后会先显示为待确认。"}
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
