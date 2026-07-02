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
  const amountNumber = Number(amount);
  const navNumber = Number(nav);
  const sharesNumber = Number(shares);
  const hasAmount = Number.isFinite(amountNumber) && amountNumber > 0;
  const hasNav = Number.isFinite(navNumber) && navNumber > 0;
  const hasShares = Number.isFinite(sharesNumber) && sharesNumber > 0;
  const estimatedShares = type === "reinvest" && hasAmount && hasNav ? amountNumber / navNumber : null;

  return (
    <form className="data-form trade-entry-form dividend-entry-form" noValidate onSubmit={onSubmit}>
      <h3>添加分红</h3>
      <div className={`trade-type-switch trade-type-switch-animated ${type === "cash" ? "is-cash" : "is-reinvest"}`} aria-label="分红类型">
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
      </div>
      {type === "reinvest" ? (
        <div className="dividend-entry-layout">
          <div className="form-row dividend-core-row">
            <label>
              <span>分红金额</span>
              <input type="number" min="0" step="0.01" value={amount} disabled={busy} required placeholder="例如：88.80" onChange={(event) => onAmountChange(event.target.value)} />
            </label>
            <label>
              <span>再投净值</span>
              <input type="number" min="0" step="0.0001" value={nav} disabled={busy} placeholder="例如：1.2356" onChange={(event) => onNavChange(event.target.value)} />
            </label>
          </div>
          <div className="form-row dividend-support-row">
            <label>
              <span>再投份额</span>
              <input type="number" min="0" step="0.01" value={shares} disabled={busy} placeholder="可直接填写份额" onChange={(event) => onSharesChange(event.target.value)} />
            </label>
            <div className="dividend-assist">
              <div className="dividend-assist-meta">
                <span>自动换算</span>
                <strong>{estimatedShares != null ? `${estimatedShares.toFixed(2)} 份` : "--"}</strong>
              </div>
              <p>
                {estimatedShares != null
                  ? `按再投净值 ${navNumber.toFixed(4)} 预计可获得 ${estimatedShares.toFixed(2)} 份。`
                  : "填写分红金额和再投净值后，系统会帮助你核对可获得份额。"}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="form-row compact">
          <label>
            <span>分红金额</span>
            <input type="number" min="0" step="0.01" value={amount} disabled={busy} required placeholder="例如：88.80" onChange={(event) => onAmountChange(event.target.value)} />
          </label>
        </div>
      )}
      <label>
        <span>备注</span>
        <input value={note} disabled={busy} placeholder="可选" onChange={(event) => onNoteChange(event.target.value)} />
      </label>
      {type === "cash" ? (
        <div className="dividend-feedback">
          <strong>现金分红会直接计入已实现收益</strong>
          <span>{hasAmount ? `本次记录分红金额 ${amountNumber.toFixed(2)}。` : "填写分红金额后即可保存。"}</span>
        </div>
      ) : (
        <div className="dividend-feedback">
          <strong>红利再投会增加持有份额</strong>
          <span>
            {hasShares
              ? `当前填写再投份额 ${sharesNumber.toFixed(2)} 份。`
              : estimatedShares != null
                ? `若按当前净值计算，预计再投 ${estimatedShares.toFixed(2)} 份。`
                : "你可以直接填写再投份额，也可以用金额和净值辅助核对。"}
          </span>
        </div>
      )}
      <button type="submit" disabled={busy}>
        保存分红
      </button>
    </form>
  );
}
