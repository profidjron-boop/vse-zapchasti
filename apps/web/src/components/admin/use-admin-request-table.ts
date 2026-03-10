import { useCallback, useMemo, useState } from "react";
import { type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";
import { bulkUpdateStatuses } from "@/components/admin/request-list-helpers";

type RequestFilters = {
  status: string;
  search: string;
};

type UseAdminRequestTableOptions = {
  page: number;
  pageSize: number;
  appliedFilters: RequestFilters;
  fetchPath: string;
  fetchErrorMessage: string;
  bulkPath: (id: number) => string;
  emptySelectionError: string;
  bulkFailedMessage: (failed: number) => string;
  router: AppRouterInstance;
  setError: (value: string) => void;
  setSuccess: (value: string) => void;
};

type UseAdminRequestTableResult<T extends { id: number }> = {
  requests: T[];
  loading: boolean;
  isRefreshing: boolean;
  lastUpdated: string;
  hasNextPage: boolean;
  selectedRequestIds: number[];
  bulkStatus: string;
  bulkUpdating: boolean;
  setBulkStatus: (value: string) => void;
  allSelected: boolean;
  refreshRequests: (showRefreshing?: boolean) => Promise<void>;
  handleBulkStatusUpdate: () => Promise<void>;
  toggleSelectAll: () => void;
  toggleSelectRequest: (requestId: number) => void;
};

export function useAdminRequestTable<T extends { id: number }>({
  page,
  pageSize,
  appliedFilters,
  fetchPath,
  fetchErrorMessage,
  bulkPath,
  emptySelectionError,
  bulkFailedMessage,
  router,
  setError,
  setSuccess,
}: UseAdminRequestTableOptions): UseAdminRequestTableResult<T> {
  const [requests, setRequests] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [hasNextPage, setHasNextPage] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const refreshRequests = useCallback(
    async (showRefreshing = false) => {
      setError("");
      if (showRefreshing) {
        setIsRefreshing(true);
      }

      try {
        const apiBaseUrl = getClientApiBaseUrl();
        const query = new URLSearchParams({
          skip: String((page - 1) * pageSize),
          limit: String(pageSize + 1),
        });
        if (appliedFilters.status) {
          query.set("status", appliedFilters.status);
        }
        if (appliedFilters.search.trim()) {
          query.set("search", appliedFilters.search.trim());
        }

        const data = await fetchJsonWithTimeout<T[]>(
          withApiBase(apiBaseUrl, `${fetchPath}?${query.toString()}`),
          {},
          12000,
        );
        const nextPageAvailable = data.length > pageSize;
        const pageRows = nextPageAvailable ? data.slice(0, pageSize) : data;
        setRequests(pageRows);
        setHasNextPage(nextPageAvailable);
        setSelectedRequestIds((prev) =>
          prev.filter((id) => pageRows.some((request) => request.id === id)),
        );
        setLastUpdated(new Date().toLocaleTimeString("ru-RU"));
      } catch (fetchError) {
        if (
          fetchError instanceof ApiRequestError &&
          (fetchError.status === 401 || fetchError.status === 403)
        ) {
          router.push("/admin/login");
          return;
        }
        if (fetchError instanceof ApiRequestError) {
          setError(
            fetchError.traceId
              ? `${fetchError.message}. Код: ${fetchError.traceId}`
              : fetchError.message,
          );
        } else {
          setError(fetchErrorMessage);
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      appliedFilters.search,
      appliedFilters.status,
      fetchErrorMessage,
      fetchPath,
      page,
      pageSize,
      router,
      setError,
    ],
  );

  const handleBulkStatusUpdate = useCallback(async () => {
    if (selectedRequestIds.length === 0) {
      setError(emptySelectionError);
      return;
    }
    if (!bulkStatus) {
      setError("Выберите статус для массового обновления");
      return;
    }

    setBulkUpdating(true);
    setError("");
    setSuccess("");

    try {
      const { updated, failed, firstError, redirected } =
        await bulkUpdateStatuses({
          selectedIds: selectedRequestIds,
          status: bulkStatus,
          endpointPath: bulkPath,
          onUnauthorized: () => router.push("/admin/login"),
        });

      if (redirected) {
        return;
      }
      if (updated > 0) {
        setSuccess(`Обновлено: ${updated}. Ошибок: ${failed}.`);
      }
      if (failed > 0) {
        setError(firstError || bulkFailedMessage(failed));
      }

      setSelectedRequestIds([]);
      setBulkStatus("");
      await refreshRequests(true);
    } finally {
      setBulkUpdating(false);
    }
  }, [
    bulkFailedMessage,
    bulkPath,
    bulkStatus,
    emptySelectionError,
    refreshRequests,
    router,
    selectedRequestIds,
    setError,
    setSuccess,
  ]);

  const allSelected = useMemo(
    () => requests.length > 0 && selectedRequestIds.length === requests.length,
    [requests.length, selectedRequestIds.length],
  );

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedRequestIds([]);
      return;
    }
    setSelectedRequestIds(requests.map((request) => request.id));
  }, [allSelected, requests]);

  const toggleSelectRequest = useCallback((requestId: number) => {
    setSelectedRequestIds((prev) =>
      prev.includes(requestId)
        ? prev.filter((id) => id !== requestId)
        : [...prev, requestId],
    );
  }, []);

  return {
    requests,
    loading,
    isRefreshing,
    lastUpdated,
    hasNextPage,
    selectedRequestIds,
    bulkStatus,
    bulkUpdating,
    setBulkStatus,
    allSelected,
    refreshRequests,
    handleBulkStatusUpdate,
    toggleSelectAll,
    toggleSelectRequest,
  };
}
