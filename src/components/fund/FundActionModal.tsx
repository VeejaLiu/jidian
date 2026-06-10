import { useEffect, type FormEvent } from "react";
import type { Fund } from "../../types/fund";
import type { FundAction } from "./FundActionMenu";

interface FundActionModalProps {
  action: FundAction | null;
  fund: Fund;
  busy: boolean;
  dropRateDraft: string;
  onDropRateDraftChange: (value: string) => void;
  onClose: () => void;
  onConfirmDropRate: () => boolean | Promise<boolean>;
  onConfirmSyncNav: () => boolean | Promise<boolean>;
  onConfirmHideFund: () => boolean | Promise<boolean>;
}

export function FundActionModal({
  action,
  fund,
  busy,
  dropRateDraft,
  onDropRateDraftChange,
  onClose,
  onConfirmDropRate,
  onConfirmSyncNav,
  onConfirmHideFund,
}: FundActionModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && action && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [action, busy, onClose]);

  if (!action) return null;

  const meta = getActionMeta(action, fund.name);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let ok = false;
    if (action === "dropRate") ok = await onConfirmDropRate();
    if (action === "syncNav") ok = await onConfirmSyncNav();
    if (action === "hideFund") ok = await onConfirmHideFund();
    if (ok) onClose();
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fundActionModalTitle"
      onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <form className="modal-panel fund-action-modal" onSubmit={submit}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{meta.eyebrow}</p>
            <h2 id="fundActionModalTitle">{meta.title}</h2>
          </div>
          <button className="icon-button light" type="button" aria-label="关闭" disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={`fund-action-brief ${meta.tone}`}>
          <span aria-hidden="true">{meta.mark}</span>
          <div>
            <strong>{meta.summary}</strong>
            <p>{meta.description}</p>
          </div>
        </div>

        {action === "dropRate" && (
          <label className="fund-action-field">
            <span>跌幅阈值</span>
            <div className="percent-input">
              <input
                type="number"
                min="0.1"
                max="99"
                step="0.1"
                value={dropRateDraft}
                disabled={busy}
                autoFocus
                onChange={(event) => onDropRateDraftChange(event.target.value)}
              />
              <span>%</span>
            </div>
          </label>
        )}

        <div className="modal-actions">
          <button className="secondary-button neutral-button" type="button" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button className={`secondary-button ${meta.tone === "danger" ? "danger-button" : ""}`} type="submit" disabled={busy}>
            {busy ? meta.busyLabel : meta.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function getActionMeta(action: FundAction, fundName: string) {
  if (action === "dropRate") {
    return {
      eyebrow: "定投策略",
      title: "修改跌幅阈值",
      summary: `调整「${fundName}」的触发规则`,
      description: "新的阈值会只作用在当前账户下的这只基金，不影响其他账户或其他基金。",
      confirmLabel: "保存阈值",
      busyLabel: "保存中...",
      mark: "%",
      tone: "primary",
    };
  }

  if (action === "syncNav") {
    return {
      eyebrow: "净值同步",
      title: "更新净值",
      summary: `立即同步「${fundName}」的净值`,
      description: "系统会从公开数据源拉取最新净值，并尝试确认待确认交易。",
      confirmLabel: "开始更新",
      busyLabel: "更新中...",
      mark: "↻",
      tone: "primary",
    };
  }

  return {
    eyebrow: "基金管理",
    title: "隐藏基金",
    summary: `从列表中隐藏「${fundName}」`,
    description: "隐藏后不会删除交易记录、持仓数据或历史净值，你可以在隐藏基金列表中恢复显示。",
    confirmLabel: "确认隐藏",
    busyLabel: "隐藏中...",
    mark: "!",
    tone: "danger",
  };
}
