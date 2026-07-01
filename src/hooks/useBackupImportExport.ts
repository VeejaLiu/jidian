import { useCallback, useState } from "react";
import { api } from "../api/client";
import type { BackupImportPreview } from "../components/account/BackupImportPreviewModal";
import type { BackupPayload } from "../types/fund";

type RunWithBusy = <T>(label: string, action: () => Promise<T>) => Promise<T | null>;

interface UseBackupImportExportOptions {
  runWithBusy: RunWithBusy;
  reloadAfterImport: () => Promise<void>;
}

export function useBackupImportExport({ runWithBusy, reloadAfterImport }: UseBackupImportExportOptions) {
  const [backupImportDraft, setBackupImportDraft] = useState<{ file: File; payload: BackupPayload; preview: BackupImportPreview } | null>(null);

  const handleExportBackup = useCallback(() => {
    runWithBusy("导出备份中...", async () => {
      const payload = await api<BackupPayload>("/api/backup/export");
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/:/g, "-");
      link.href = url;
      link.download = `jidian-backup-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return true;
    });
  }, [runWithBusy]);

  const handlePreviewBackupImport = useCallback((file: File) => {
    runWithBusy("校验备份中...", async () => {
      const text = await file.text();
      const payload = JSON.parse(text) as BackupPayload;
      const result = await api<{ preview: BackupImportPreview }>("/api/backup/preview", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setBackupImportDraft({ file, payload, preview: result.preview });
      return true;
    });
  }, [runWithBusy]);

  const handleImportBackup = useCallback(() => {
    if (!backupImportDraft) return;
    runWithBusy("导入备份中...", async () => {
      await api("/api/backup/import", {
        method: "POST",
        body: JSON.stringify(backupImportDraft.payload),
      });
      setBackupImportDraft(null);
      await reloadAfterImport();
      window.alert("导入完成");
      return true;
    });
  }, [backupImportDraft, reloadAfterImport, runWithBusy]);

  return {
    backupImportDraft,
    setBackupImportDraft,
    handleExportBackup,
    handlePreviewBackupImport,
    handleImportBackup,
  };
}
