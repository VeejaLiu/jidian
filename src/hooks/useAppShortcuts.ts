import { useEffect, type RefObject } from "react";
import type { Fund } from "../types/fund";

interface UseAppShortcutsOptions {
  busy: boolean;
  addingFundBusy: boolean;
  selectedFund: Fund | null;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onOpenSearch: () => void;
  onOpenAddFund: () => void;
  onSyncNav: () => void;
}

export function useAppShortcuts({
  busy,
  addingFundBusy,
  selectedFund,
  searchInputRef,
  onOpenSearch,
  onOpenAddFund,
  onSyncNav,
}: UseAppShortcutsOptions) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier) return;
      const key = event.key.toLowerCase();
      if (key === "n") {
        event.preventDefault();
        if (!busy && !addingFundBusy) onOpenAddFund();
      }
      if (key === "f") {
        event.preventDefault();
        onOpenSearch();
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
      }
      if (key === "r") {
        event.preventDefault();
        if (!busy && selectedFund) onSyncNav();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addingFundBusy, busy, onOpenAddFund, onOpenSearch, onSyncNav, searchInputRef, selectedFund]);
}
