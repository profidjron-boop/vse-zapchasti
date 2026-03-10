"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RequestListDataLayout,
  RequestListEmptyState,
  RequestListFeedback,
  RequestListFilters,
  RequestListHeader,
  RequestListPresets,
} from "@/components/admin/request-list-shared";
import {
  normalizePageSize,
} from "@/components/admin/use-admin-request-list-state";
import { downloadCsv } from "@/components/admin/request-list-helpers";
import { useAdminRequestListPage } from "@/components/admin/use-admin-request-list-page";
import {
  BASIC_REQUEST_STATUS_OPTIONS,
  getBasicRequestStatusColor,
  getBasicRequestStatusLabel,
} from "@/components/admin/request-status-shared";

type VinRequest = {
  id: number;
  uuid: string;
  status: "new" | "in_progress" | "closed";
  vin: string;
  name: string | null;
  phone: string;
  email: string | null;
  message: string | null;
  consent_given: boolean;
  created_at: string;
};

const FILTER_PRESETS_STORAGE_KEY = "admin_vin_requests_filter_presets_v1";

export default function AdminVinRequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    error,
    setError,
    success,
    setSuccess,
    status,
    setStatus,
    search,
    setSearch,
    appliedFilters,
    presets,
    presetName,
    setPresetName,
    selectedPresetId,
    setSelectedPresetId,
    page,
    setPage,
    pageSize,
    setPageSize,
    pageInput,
    setPageInput,
    handleApplyFilters,
    handleResetFilters,
    handlePageJump,
    handleSavePreset,
    handleApplyPreset,
    handleDeletePreset,
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
  } = useAdminRequestListPage<VinRequest>({
    searchParams,
    router,
    basePath: "/admin/vin-requests",
    storageKey: FILTER_PRESETS_STORAGE_KEY,
    fetchPath: "/api/admin/vin-requests",
    fetchErrorMessage: "Ошибка загрузки VIN-заявок",
    bulkPath: (id) => `/api/admin/vin-requests/${id}/status`,
    emptySelectionError: "Выберите хотя бы одну VIN-заявку",
    bulkFailedMessage: (failed) => `Не удалось обновить ${failed} VIN-заявок`,
  });

  const handleExportCsv = () => {
    if (requests.length === 0) {
      setError("Нет данных для экспорта");
      return;
    }

    const headers = [
      "ID",
      "Статус",
      "VIN",
      "Имя",
      "Телефон",
      "Email",
      "Согласие",
      "Дата",
    ];
    const rows = requests.map((request) => [
      String(request.id),
      getBasicRequestStatusLabel(request.status),
      request.vin || "",
      request.name || "",
      request.phone || "",
      request.email || "",
      request.consent_given ? "Да" : "Нет",
      new Date(request.created_at).toLocaleString("ru-RU"),
    ]);
    downloadCsv("vin-requests", headers, rows);
    setSuccess("CSV экспортирован");
  };
  const statusOptions = BASIC_REQUEST_STATUS_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[#1F3B73]">Загрузка...</div>
      </div>
    );
  }

  return (
    <div>
      <RequestListHeader
        title="VIN-заявки"
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRefresh={() => void refreshRequests(true)}
      />
      <RequestListFilters
        status={status}
        search={search}
        statusOptions={statusOptions}
        searchPlaceholder="VIN, телефон, имя, email"
        isRefreshing={isRefreshing}
        onStatusChange={setStatus}
        onSearchChange={setSearch}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
      />
      <RequestListPresets
        presetName={presetName}
        selectedPresetId={selectedPresetId}
        presets={presets}
        onPresetNameChange={setPresetName}
        onSelectedPresetIdChange={setSelectedPresetId}
        onSavePreset={handleSavePreset}
        onApplyPreset={handleApplyPreset}
        onDeletePreset={handleDeletePreset}
      />
      <RequestListFeedback error={error} success={success} />

      {requests.length === 0 ? (
        <RequestListEmptyState
          hasFilters={Boolean(appliedFilters.status || appliedFilters.search.trim())}
          filteredTitle="По выбранным фильтрам VIN-заявок не найдено"
          filteredSubtitle="Попробуйте изменить параметры поиска или сбросить фильтры"
          emptyTitle="VIN-заявок пока нет"
          emptySubtitle="Они появятся после отправки формы на странице /parts/vin"
        />
      ) : (
        <RequestListDataLayout
          requestsCount={requests.length}
          page={page}
          selectedCount={selectedRequestIds.length}
          bulkStatus={bulkStatus}
          bulkStatusOptions={statusOptions}
          bulkUpdating={bulkUpdating}
          pageSize={pageSize}
          onBulkStatusChange={setBulkStatus}
          onBulkApply={() => void handleBulkStatusUpdate()}
          onExportCsv={handleExportCsv}
          onPageSizeChange={(value) => {
            setPageSize(normalizePageSize(value));
            setPage(1);
          }}
          mobileContent={requests.map((request) => (
            <article key={request.id} className="space-y-3 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <label className="flex items-center gap-2 text-sm text-neutral-600">
                    <input
                      type="checkbox"
                      checked={selectedRequestIds.includes(request.id)}
                      onChange={() => toggleSelectRequest(request.id)}
                      aria-label={`Выбрать VIN-заявку ${request.id}`}
                    />
                    <span>#{request.id}</span>
                  </label>
                  <div className="mt-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${getBasicRequestStatusColor(request.status)}`}
                    >
                      {getBasicRequestStatusLabel(request.status)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1 text-sm text-neutral-700">
                <p className="break-all font-mono">VIN: {request.vin}</p>
                <p>Телефон: {request.phone}</p>
                <p>Имя: {request.name || "—"}</p>
                <p>Согласие: {request.consent_given ? "Да" : "Нет"}</p>
                <p className="text-xs text-neutral-500">
                  {new Date(request.created_at).toLocaleString("ru-RU")}
                </p>
              </div>

              <Link
                className="text-sm font-medium text-[#1F3B73] hover:underline"
                href={`/admin/vin-requests/${request.id}`}
              >
                Открыть карточку
              </Link>
            </article>
          ))}
          desktopContent={
            <table className="w-full min-w-[1040px]">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Выбрать все VIN-заявки"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Статус
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    VIN
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Телефон
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Имя
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Согласие
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Дата
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Карточка
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedRequestIds.includes(request.id)}
                        onChange={() => toggleSelectRequest(request.id)}
                        aria-label={`Выбрать VIN-заявку ${request.id}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      #{request.id}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${getBasicRequestStatusColor(request.status)}`}
                      >
                        {getBasicRequestStatusLabel(request.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">
                      {request.vin}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {request.phone}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {request.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {request.consent_given ? "Да" : "Нет"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {new Date(request.created_at).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <Link
                        className="text-[#1F3B73] hover:underline"
                        href={`/admin/vin-requests/${request.id}`}
                      >
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
          hasNextPage={hasNextPage}
          isRefreshing={isRefreshing}
          pageInput={pageInput}
          jumpInputId="vin-requests-page-jump"
          onPageInputChange={setPageInput}
          onPrevPage={() => setPage((prev) => Math.max(1, prev - 1))}
          onNextPage={() => setPage((prev) => prev + 1)}
          onJumpToPage={handlePageJump}
        />
      )}
    </div>
  );
}
