import type { FormEvent } from "react";
import { DatePicker } from "../DatePicker";
import type { DividendType } from "../../types/fund";

interface DividendFormProps {
  busy: boolean;
  type: DividendType;
  date: string;
  amount: string;
  nav: string;
  shares: string;
  note: string;
  onTypeChange: (type: DividendType) => void;
  onDateChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onNavChange: (value: string) => void;
  onSharesChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function DividendForm({
  busy,
  type,
  date,
  amount,
  nav,
  shares,
  note,
  onTypeChange,
  onDateChange,
  onAmountChange,
  onNavChange,
  onSharesChange,
  onNoteChange,
  onSubmit,
}: DividendFormProps) {
  return (
    <form className="data-form dividend-form" noValidate onSubmit={onSubmit}>
      <h3>添加分红</h3>
      <div className="trade-type-switch" aria-label="分红类型">
        <button className={type === "cash" ? "active" : ""} type="button" disabled={busy} onClick={() => onTypeChange("cash")}>
          现金分红
        </button>
        <button className={type === "reinvest" ? "active" : ""} type="button" disabled={busy} onClick={() => onTypeChange("reinvest")}>
          红利再投
        </button>
      </div>
      <div className="form-row compact">
        <label>
          <span>日期</span>
          <DatePicker value={date} disabled={busy} onChange={onDateChange} />
        </label>
        <label>
          <span>分红金额</span>
          <input type="number" min="0" step="0.01" value={amount} disabled={busy} required onChange={(event) => onAmountChange(event.target.value)} />
        </label>
      </div>
      {type === "reinvest" && (
        <div className="form-row compact">
          <label>
            <span>再投净值</span>
            <input type="number" min="0" step="0.0001" value={nav} disabled={busy} placeholder="可用净值计算份额" onChange={(event) => onNavChange(event.target.value)} />
          </label>
          <label>
            <span>再投份额</span>
            <input type="number" min="0" step="0.01" value={shares} disabled={busy} placeholder="或直接填写份额" onChange={(event) => onSharesChange(event.target.value)} />
          </label>
        </div>
      )}
      <label>
        <span>备注</span>
        <input value={note} disabled={busy} placeholder="可选" onChange={(event) => onNoteChange(event.target.value)} />
      </label>
      <button type="submit" disabled={busy}>
        保存分红
      </button>
    </form>
  );
}
