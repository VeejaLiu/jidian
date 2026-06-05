import { useEffect } from "react";
import type { Fund } from "../../types/fund";

interface HiddenFundsModalProps {
  open: boolean;
  funds: Fund[];
  loading: boolean;
  busy: boolean;
  onClose: () => void;
  onRestore: (fund: Fund) => void;
}

export function HiddenFundsModal({
  open,
  funds,
  loading,
  busy,
  onClose,
  onRestore,
}: HiddenFundsModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="hiddenFundsModalTitle" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className="modal-panel hidden-funds-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">基金管理</p>
            <h2 id="hiddenFundsModalTitle">隐藏基金列表</h2>
          </div>
          <button className="icon-button light" type="button" aria-label="关闭" disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="hidden-funds-list">
          {loading ? (
            <div className="modal-inline-loading">
              <div className="spinner small" aria-hidden="true"></div>
              <strong>加载中...</strong>
            </div>
          ) : funds.length === 0 ? (
            <p className="empty-row">暂无隐藏的基金</p>
          ) : (
            funds.map((fund) => (
              <div className="hidden-fund-item" key={fund.id}>
                <div>
                  <strong>{fund.name}</strong>
                  <span>{[fund.code, fund.fundType].filter(Boolean).join(" / ") || "未填写代码"}</span>
                </div>
                <button className="secondary-button" type="button" disabled={busy} onClick={() => onRestore(fund)}>
                  恢复显示
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
