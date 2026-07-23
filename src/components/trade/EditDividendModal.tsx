import { useEffect, type FormEvent } from "react";
import { DatePicker } from "../DatePicker";
import type { DividendRecord, DividendType, Fund } from "../../types/fund";
import { ActionTypePicker } from "./ActionTypePicker";

export interface DividendDraft {
  type: DividendType;
  date: string;
  amount: string;
  nav: string;
  shares: string;
  note: string;
}

interface EditDividendModalProps {
  fund: Fund;
  record: DividendRecord | null;
  draft: DividendDraft | null;
  busy: boolean;
  onDraftChange: (draft: DividendDraft) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function EditDividendModal({ fund, record, draft, busy, onDraftChange, onClose, onSubmit }: EditDividendModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && record && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, record]);

  if (!record || !draft) return null;
  const isStock = fund.assetType === "stock";
  const isReinvest = draft.type === "reinvest";
  const isStockBonus = draft.type === "stock_bonus";
  const isCapitalIncrease = draft.type === "capital_increase";
  const isShareIncrease = isStockBonus || isCapitalIncrease;
  const isTax = draft.type === "dividend_tax";
  const options: Array<{ value: DividendType; label: string }> = [
    { value: "cash", label: "现金分红" },
    { value: "reinvest", label: "红利再投" },
    ...(isStock ? [{ value: "stock_bonus" as const, label: "送股" }, { value: "capital_increase" as const, label: "转增股本" }, { value: "dividend_tax" as const, label: "股息税" }] : []),
  ];
  const set = (field: keyof DividendDraft, value: string) => onDraftChange({ ...draft, [field]: value });

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="editDividendModalTitle" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form className="modal-panel trade-edit-modal trade-entry-form" noValidate onSubmit={onSubmit}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">分红与公司行为</p>
            <h2 id="editDividendModalTitle">编辑记录</h2>
          </div>
          <button className="icon-button light" type="button" aria-label="关闭" disabled={busy} onClick={onClose}>×</button>
        </div>
        <ActionTypePicker value={draft.type} options={options} disabled={busy} onChange={(value) => set("type", value)} />
        <div className="form-row compact">
          <label><span>日期</span><DatePicker value={draft.date} disabled={busy} onChange={(value) => set("date", value)} /></label>
        </div>
        {isReinvest ? (
          <div className="form-row">
            <label><span>分红金额</span><input type="number" min="0" step="0.01" value={draft.amount} disabled={busy} required onChange={(event) => set("amount", event.target.value)} /></label>
            <label><span>再投净值</span><input type="number" min="0" step="0.0001" value={draft.nav} disabled={busy} onChange={(event) => set("nav", event.target.value)} /></label>
            <label><span>再投份额</span><input type="number" min="0" step="0.01" value={draft.shares} disabled={busy} onChange={(event) => set("shares", event.target.value)} /></label>
          </div>
        ) : isShareIncrease ? (
          <label><span>{isCapitalIncrease ? "转增股数" : "送股数量"}</span><input type="number" min="0" step="1" value={draft.shares} disabled={busy} required onChange={(event) => set("shares", event.target.value)} /></label>
        ) : (
          <label><span>{isTax ? "扣税金额" : "分红金额"}</span><input type="number" min="0" step="0.01" value={draft.amount} disabled={busy} required onChange={(event) => set("amount", event.target.value)} /></label>
        )}
        <label><span>备注</span><input value={draft.note} disabled={busy} onChange={(event) => set("note", event.target.value)} /></label>
        <div className="modal-actions">
          <button className="secondary-button neutral-button" type="button" disabled={busy} onClick={onClose}>取消</button>
          <button className="secondary-button" type="submit" disabled={busy}>{busy ? "保存中..." : "保存修改"}</button>
        </div>
      </form>
    </div>
  );
}
