import { useCallback, useState } from "react";
import { api } from "../api/client";
import { MIN_NAV_MODAL_LOADING_MS } from "../constants/app";
import type { NavModalState } from "../components/nav/NavHistoryModal";
import type { Fund, NavHistoryPage } from "../types/fund";

const initialNavModal: NavModalState = {
  open: false,
  page: 1,
  pageSize: 20,
  rows: [],
  total: 0,
  totalPages: 1,
  loading: false,
};

export function useNavHistoryModal() {
  const [navModal, setNavModal] = useState<NavModalState>(initialNavModal);
  const [activeFundId, setActiveFundId] = useState<number | null>(null);

  const closeNavModal = useCallback(() => {
    setNavModal((current) => ({ ...current, open: false }));
  }, []);

  const loadNavPage = useCallback(async (fundId: number, page = 1) => {
    setNavModal((current) => ({ ...current, loading: true }));
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      const [payload] = await Promise.all([
        api<NavHistoryPage>(`/api/assets/${fundId}/prices?${params.toString()}`),
        new Promise((resolve) => window.setTimeout(resolve, MIN_NAV_MODAL_LOADING_MS)),
      ]);
      setNavModal((current) => ({
        ...current,
        page: payload.page,
        pageSize: payload.pageSize,
        rows: payload.rows || [],
        total: payload.total || 0,
        totalPages: payload.totalPages || 1,
        loading: false,
      }));
    } catch (error) {
      setNavModal((current) => ({ ...current, loading: false }));
      throw error;
    }
  }, []);

  const handleViewAllNav = useCallback((fund: Fund | null) => {
    if (!fund) return;

    setActiveFundId(fund.id);
    setNavModal((current) => ({ ...current, open: true, page: 1, rows: [], total: 0, totalPages: 1 }));
    loadNavPage(fund.id, 1).catch((error) =>
      window.alert(error instanceof Error ? error.message : "操作失败"),
    );
  }, [loadNavPage]);

  const handlePrevNavPage = useCallback(() => {
    if (!activeFundId || navModal.page <= 1) return;
    loadNavPage(activeFundId, navModal.page - 1).catch((error) =>
      window.alert(error instanceof Error ? error.message : "操作失败"),
    );
  }, [activeFundId, loadNavPage, navModal.page]);

  const handleNextNavPage = useCallback(() => {
    if (!activeFundId || navModal.page >= navModal.totalPages) return;
    loadNavPage(activeFundId, navModal.page + 1).catch((error) =>
      window.alert(error instanceof Error ? error.message : "操作失败"),
    );
  }, [activeFundId, loadNavPage, navModal.page, navModal.totalPages]);

  return {
    navModal,
    closeNavModal,
    handleViewAllNav,
    handlePrevNavPage,
    handleNextNavPage,
  };
}
