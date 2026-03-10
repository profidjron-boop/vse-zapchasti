import { useEffect, useState } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useAdminRequestListState } from "@/components/admin/use-admin-request-list-state";
import { useAdminRequestTable } from "@/components/admin/use-admin-request-table";

type SearchParamsLike = {
  get: (name: string) => string | null;
};

type UseAdminRequestListPageOptions = {
  searchParams: SearchParamsLike;
  router: AppRouterInstance;
  basePath: string;
  storageKey: string;
  fetchPath: string;
  fetchErrorMessage: string;
  bulkPath: (id: number) => string;
  emptySelectionError: string;
  bulkFailedMessage: (failed: number) => string;
};

export function useAdminRequestListPage<T extends { id: number }>({
  searchParams,
  router,
  basePath,
  storageKey,
  fetchPath,
  fetchErrorMessage,
  bulkPath,
  emptySelectionError,
  bulkFailedMessage,
}: UseAdminRequestListPageOptions) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const listState = useAdminRequestListState({
    searchParams,
    router,
    basePath,
    storageKey,
    setError,
    setSuccess,
  });

  const tableState = useAdminRequestTable<T>({
    page: listState.page,
    pageSize: listState.pageSize,
    appliedFilters: listState.appliedFilters,
    fetchPath,
    fetchErrorMessage,
    bulkPath,
    emptySelectionError,
    bulkFailedMessage,
    router,
    setError,
    setSuccess,
  });
  const { refreshRequests } = tableState;

  useEffect(() => {
    void refreshRequests();
  }, [refreshRequests]);

  return {
    error,
    setError,
    success,
    setSuccess,
    ...listState,
    ...tableState,
  };
}
