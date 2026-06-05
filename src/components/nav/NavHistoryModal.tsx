import { useEffect } from "react";
import { DataTable } from "../DataTable";
import type { Fund, NavHistoryPage } from "../../types/fund";
import { formatNav } from "../../utils/format";

export interface NavModalState extends NavHistoryPage {
  open: boolean;
  loading: boolean;
}

interface NavHistoryModalProps {
  fund: Fund | null;
  modal: NavModalState;
  busy: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function NavHistoryModal({ fund, modal, busy, onClose, onPrev, onNext }: NavHistoryModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && modal.open) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modal.open, onClose]);

  if (!modal.open || !fund) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="navModalTitle" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-panel nav-history-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">历史净值</p>
            <h2 id="navModalTitle">{fund.name} / 全部净值</h2>
          </div>
          <button className="icon-button light" type="button" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="table-wrap modal-table">
          {modal.loading && (
            <div className="modal-table-loading" aria-live="polite">
              <div className="spinner small" aria-hidden="true"></div>
              <strong>加载历史净值中...</strong>
            </div>
          )}
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>单位净值</th>
                <th>累计净值</th>
              </tr>
            </thead>
            <DataTable
              records={modal.rows}
              columns={[
                { key: "date", render: (record) => record.date },
                { key: "nav", render: (record) => formatNav(record.nav) },
                { key: "accumulatedNav", render: (record) => formatNav(record.accumulatedNav) },
              ]}
              emptyText={modal.loading ? "" : "暂无记录"}
            />
          </table>
        </div>
        <div className="pagination">
          <button className="secondary-button" type="button" disabled={busy || modal.loading || modal.page <= 1} onClick={onPrev}>
            上一页
          </button>
          <span>
            {modal.loading
              ? "加载中..."
              : modal.total === 0
                ? "暂无记录"
                : `第 ${modal.page} / ${modal.totalPages} 页，共 ${modal.total} 条`}
          </span>
          <button
            className="secondary-button"
            type="button"
            disabled={busy || modal.loading || modal.page >= modal.totalPages}
            onClick={onNext}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
