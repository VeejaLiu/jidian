import { useEffect, useState, type FormEvent } from "react";
import type { UserAccount } from "../../types/fund";

interface AccountModalProps {
  open: boolean;
  accounts: UserAccount[];
  selectedAccount: UserAccount | null;
  busy: boolean;
  onClose: () => void;
  onSelectAccount: (accountId: number) => void;
  onCreateAccount: (name: string) => void;
  onRenameAccount: (account: UserAccount, name: string) => void;
  onDeleteAccount: (account: UserAccount) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
}

export function AccountModal({
  open,
  accounts,
  selectedAccount,
  busy,
  onClose,
  onSelectAccount,
  onCreateAccount,
  onRenameAccount,
  onDeleteAccount,
  onExportBackup,
  onImportBackup,
}: AccountModalProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, open]);

  useEffect(() => {
    if (!open) {
      setNewName("");
      setEditingId(null);
      setEditingName("");
    }
  }, [open]);

  if (!open) return null;

  const submitNewAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;
    onCreateAccount(name);
    setNewName("");
  };

  const submitRename = (event: FormEvent<HTMLFormElement>, account: UserAccount) => {
    event.preventDefault();
    const name = editingName.trim();
    if (!name || name === account.name || busy) {
      setEditingId(null);
      return;
    }
    onRenameAccount(account, name);
    setEditingId(null);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="accountModalTitle" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className="modal-panel account-modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">账户管理</p>
            <h2 id="accountModalTitle">切换账户</h2>
          </div>
          <button className="icon-button light" type="button" aria-label="关闭" disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>

        <div className="account-modal-list">
          {accounts.map((account) => {
            const isActive = account.id === selectedAccount?.id;
            const isEditing = editingId === account.id;
            return (
              <div className={`account-card${isActive ? " active" : ""}`} key={account.id}>
                <button className="account-card-main" type="button" disabled={busy} onClick={() => onSelectAccount(account.id)}>
                  <span className="account-avatar">{account.name.slice(0, 1)}</span>
                  <span>
                    <strong>{account.name}</strong>
                    <small>{isActive ? "当前账户" : "点击切换"}</small>
                  </span>
                </button>

                {isEditing ? (
                  <form className="account-edit-form" onSubmit={(event) => submitRename(event, account)}>
                    <input value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus disabled={busy} />
                    <button className="secondary-button" type="submit" disabled={busy}>保存</button>
                    <button className="secondary-button neutral-button" type="button" disabled={busy} onClick={() => setEditingId(null)}>取消</button>
                  </form>
                ) : (
                  <div className="account-card-actions">
                    <button type="button" disabled={busy} onClick={() => {
                      setEditingId(account.id);
                      setEditingName(account.name);
                    }}>
                      重命名
                    </button>
                    <button className="danger" type="button" disabled={busy || accounts.length <= 1} onClick={() => onDeleteAccount(account)}>
                      删除
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <form className="account-create-form" onSubmit={submitNewAccount}>
          <label>
            <span>添加账户</span>
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="例如：我的账户 / 家人账户" disabled={busy} />
          </label>
          <button className="secondary-button" type="submit" disabled={busy || !newName.trim()}>
            添加账户
          </button>
        </form>

        <div className="account-create-form">
          <button className="secondary-button" type="button" disabled={busy} onClick={onExportBackup}>
            导出全部数据
          </button>
          <label className="secondary-button" style={{ display: "inline-flex", justifyContent: "center", cursor: busy ? "not-allowed" : "pointer" }}>
            导入全部数据
            <input
              type="file"
              accept="application/json"
              disabled={busy}
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImportBackup(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
