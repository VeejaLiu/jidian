import { useEffect, type FormEvent } from "react";
import type { AssetDraft, AssetType } from "../../types/fund";

interface AddFundModalProps {
  open: boolean;
  draft: AssetDraft;
  busy: boolean;
  onDraftChange: (draft: AssetDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export function AddFundModal({
  open,
  draft,
  busy,
  onDraftChange,
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

  const updateType = (assetType: AssetType) => onDraftChange({ ...draft, assetType });
  const updateCode = (code: string) => onDraftChange({ ...draft, code });
  const updateName = (name: string) => onDraftChange({ ...draft, name });
  const isStock = draft.assetType === "stock";

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="addFundModalTitle" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form className="modal-panel add-fund-modal" onSubmit={onSubmit}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">添加资产</p>
            <h2 id="addFundModalTitle">添加到我的资产列表</h2>
          </div>
          <button className="icon-button light" type="button" aria-label="关闭" disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="trade-type-switch" aria-label="资产类型">
          <button
            className={draft.assetType === "fund" ? "active" : ""}
            type="button"
            aria-pressed={draft.assetType === "fund"}
            disabled={busy}
            onClick={() => updateType("fund")}
          >
            基金
          </button>
          <button
            className={draft.assetType === "stock" ? "active" : ""}
            type="button"
            aria-pressed={draft.assetType === "stock"}
            disabled={busy}
            onClick={() => updateType("stock")}
          >
            股票
          </button>
        </div>

        <label>
          <span>{isStock ? "股票代码" : "基金代码"}</span>
          <input
            value={draft.code}
            onChange={(event) => updateCode(event.target.value)}
            placeholder={isStock ? "例如：600519 或 AAPL" : "例如：000001"}
            inputMode={isStock ? "text" : "numeric"}
            disabled={busy}
            autoFocus
          />
        </label>

        <label>
          <span>{isStock ? "股票名称" : "基金名称"}</span>
          <input
            value={draft.name}
            onChange={(event) => updateName(event.target.value)}
            placeholder={isStock ? "例如：贵州茅台" : "可选，不填则尝试自动识别"}
            disabled={busy}
          />
        </label>

        <div className="modal-actions">
          <button className="secondary-button neutral-button" type="button" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button className="secondary-button" type="submit" disabled={busy}>
            {busy ? "添加中..." : `添加${isStock ? "股票" : "基金"}`}
          </button>
        </div>
      </form>
    </div>
  );
}
