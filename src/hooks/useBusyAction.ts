import { useCallback, useState } from "react";
import { DEFAULT_BUSY_LABEL } from "../constants/app";

interface BusyState {
  active: boolean;
  label: string;
}

export function useBusyAction() {
  const [busy, setBusy] = useState<BusyState>({ active: false, label: DEFAULT_BUSY_LABEL });

  const runWithBusy = useCallback(async <T,>(label: string, action: () => Promise<T>) => {
    setBusy({ active: true, label });
    try {
      return await action();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "操作失败");
      return null;
    } finally {
      setBusy({ active: false, label: DEFAULT_BUSY_LABEL });
    }
  }, []);

  return { busy, runWithBusy };
}
