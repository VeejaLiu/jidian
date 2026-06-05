import { useEffect, type FormEvent } from "react";

interface AddFundModalProps {
  open: boolean;
  fundCode: string;
  busy: boolean;
  onFundCodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export function AddFundModal({
  open,
  fundCode,
  busy,
  onFundCodeChange,
  onSubmit,
  onClose,
}: AddFundModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="addFundModalTitle" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form className="modal-panel add-fund-modal" onSubmit={onSubmit}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">添加基金</p>
            <h2 id="addFundModalTitle">添加到我的基金</h2>
          </div>
          <button className="icon-button light" type="button" aria-label="关闭" disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>

        <label>
          <span>基金代码</span>
          <input
            value={fundCode}
            onChange={(event) => onFundCodeChange(event.target.value)}
            placeholder="例如：000001"
            inputMode="numeric"
            disabled={busy}
            required
            autoFocus
          />
        </label>

        <div className="modal-actions">
          <button className="secondary-button neutral-button" type="button" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button className="secondary-button" type="submit" disabled={busy}>
            {busy ? "添加中..." : "添加基金"}
          </button>
        </div>
      </form>
    </div>
  );
}
