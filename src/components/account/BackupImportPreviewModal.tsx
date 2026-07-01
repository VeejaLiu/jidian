import type { BackupPayload } from "../../types/fund";
import { formatDateTime } from "../../utils/format";

export interface BackupImportPreview {
  version: number;
  exportedAt: string;
  compatible: boolean;
  meta: BackupPayload["meta"];
  summary: Record<string, number>;
}

interface BackupImportPreviewModalProps {
  open: boolean;
  fileName: string;
  preview: BackupImportPreview | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function BackupImportPreviewModal({
  open,
  fileName,
  preview,
  busy,
  onCancel,
  onConfirm,
}: BackupImportPreviewModalProps) {
  if (!open || !preview) return null;

  const metrics = [
    { label: "账户", value: preview.meta.accountCount },
    { label: "资产", value: preview.meta.assetCount },
    { label: "隐藏资产", value: preview.meta.hiddenAssetCount },
    { label: "交易", value: preview.meta.tradeCount },
    { label: "价格历史", value: preview.meta.priceHistoryCount },
  ];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="backupPreviewTitle" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
      <div className="modal-panel backup-preview-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">导入预览</p>
            <h2 id="backupPreviewTitle">确认覆盖当前数据</h2>
          </div>
          <button className="icon-button light" type="button" aria-label="关闭" disabled={busy} onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="backup-preview-brief">
          <strong>{fileName}</strong>
          <span>版本 {preview.version} / 导出时间 {formatDateTime(preview.exportedAt)}</span>
        </div>

        <div className="backup-preview-grid" aria-label="备份内容统计">
          {metrics.map((metric) => (
            <article key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>

        <div className="backup-preview-warning">
          <strong>导入会覆盖当前全部数据</strong>
          <p>系统会先自动保存一份当前数据备份，再导入这个文件中的账户、资产、隐藏状态、交易和价格历史。</p>
        </div>

        <div className="modal-actions">
          <button className="secondary-button neutral-button" type="button" disabled={busy} onClick={onCancel}>
            取消
          </button>
          <button className="secondary-button danger-button" type="button" disabled={busy} onClick={onConfirm}>
            {busy ? "导入中..." : "确认导入"}
          </button>
        </div>
      </div>
    </div>
  );
}
