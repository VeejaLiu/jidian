import { useEffect, type FormEvent } from "react";

interface ImportTradesModalProps {
  open: boolean;
  busy: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export function ImportTradesModal({
  open,
  busy,
  value,
  onChange,
  onSubmit,
  onClose,
}: ImportTradesModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="importTradesModalTitle" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form className="modal-panel import-trades-modal" noValidate onSubmit={onSubmit}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">批量导入</p>
            <h2 id="importTradesModalTitle">导入股票买卖记录</h2>
          </div>
          <button className="icon-button light" type="button" aria-label="关闭" disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="fund-action-brief">
          <span>表</span>
          <div>
            <strong>支持从 Excel 或券商导出的表格直接粘贴</strong>
            <p>必填列：代码、名称、买卖方向、日期、价格、数量。可选列：金额、备注、资产类型。</p>
          </div>
        </div>

        <label className="import-textarea-field">
          <span>成交记录</span>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={"代码\t名称\t买卖方向\t日期\t价格\t数量\t金额\t备注\n600519\t贵州茅台\t买入\t2026-06-01\t1500\t100\t150000\t首次建仓"}
            disabled={busy}
            required
            autoFocus
            rows={12}
          />
        </label>

        <p className="form-help">
          如果没有“金额”列，系统会按 价格 × 数量 自动计算。股票默认作为 `stock` 导入，若要混合导入基金，可增加“资产类型”列并填 `fund`。
        </p>

        <div className="modal-actions">
          <button className="secondary-button neutral-button" type="button" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button className="secondary-button" type="submit" disabled={busy}>
            {busy ? "导入中..." : "开始导入"}
          </button>
        </div>
      </form>
    </div>
  );
}
