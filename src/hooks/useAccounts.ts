import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { AccountSummary, UserAccount } from "../types/fund";

type RunWithBusy = <T>(label: string, action: () => Promise<T>) => Promise<T | null>;

interface UseAccountsOptions {
  runWithBusy: RunWithBusy;
  onAccountCreated: (accountId: number) => void;
  onAccountDeleted: (nextAccountId: number | null) => void;
}

export function useAccounts({ runWithBusy, onAccountCreated, onAccountDeleted }: UseAccountsOptions) {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [accountSummary, setAccountSummary] = useState<AccountSummary | null>(null);
  const [accountSummaryLoading, setAccountSummaryLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) || null,
    [accounts, selectedAccountId],
  );

  const accountQuery = useCallback(
    () => (selectedAccountId ? `accountId=${encodeURIComponent(selectedAccountId)}` : ""),
    [selectedAccountId],
  );

  const loadAccounts = useCallback(async () => {
    const payload = await api<{ accounts: UserAccount[] }>("/api/accounts");
    const nextAccounts = payload.accounts || [];
    setAccounts(nextAccounts);
    setSelectedAccountId((currentId) => {
      if (currentId && nextAccounts.some((account) => account.id === currentId)) return currentId;
      return nextAccounts[0]?.id ?? null;
    });
    return nextAccounts;
  }, []);

  const loadAccountSummary = useCallback(async (accountId = selectedAccountId) => {
    if (!accountId) {
      setAccountSummary(null);
      return null;
    }
    setAccountSummaryLoading(true);
    try {
      const payload = await api<AccountSummary>(`/api/accounts/${accountId}/summary`);
      setAccountSummary(payload);
      return payload;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
      return null;
    } finally {
      setAccountSummaryLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    runWithBusy("加载中...", loadAccounts);
  }, [loadAccounts, runWithBusy]);

  const handleCreateAccount = useCallback((name: string) => {
    runWithBusy("创建账户中...", async () => {
      const payload = await api<{ account: UserAccount }>("/api/accounts", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await loadAccounts();
      setSelectedAccountId(payload.account.id);
      onAccountCreated(payload.account.id);
      await loadAccountSummary(payload.account.id);
    });
  }, [loadAccountSummary, loadAccounts, onAccountCreated, runWithBusy]);

  const handleRenameAccount = useCallback((account: UserAccount, name: string) => {
    runWithBusy("重命名中...", async () => {
      await api(`/api/accounts/${account.id}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      });
      await loadAccounts();
      await loadAccountSummary();
    });
  }, [loadAccountSummary, loadAccounts, runWithBusy]);

  const handleDeleteAccount = useCallback((account: UserAccount) => {
    const confirmed = window.confirm(`确定删除「${account.name}」吗？这个账户下的基金列表和交易记录会一起删除，公共净值库不会删除。`);
    if (!confirmed) return;

    runWithBusy("删除账户中...", async () => {
      await api(`/api/accounts/${account.id}`, { method: "DELETE" });
      const nextAccounts = await loadAccounts();
      if (account.id === selectedAccountId) {
        const nextAccountId = nextAccounts.find((item) => item.id !== account.id)?.id ?? nextAccounts[0]?.id ?? null;
        setSelectedAccountId(nextAccountId);
        onAccountDeleted(nextAccountId);
        await loadAccountSummary(nextAccountId);
      }
    });
  }, [loadAccountSummary, loadAccounts, onAccountDeleted, runWithBusy, selectedAccountId]);

  return {
    accounts,
    accountSummary,
    accountSummaryLoading,
    selectedAccount,
    selectedAccountId,
    setSelectedAccountId,
    setAccountSummary,
    accountQuery,
    loadAccounts,
    loadAccountSummary,
    handleCreateAccount,
    handleRenameAccount,
    handleDeleteAccount,
  };
}
