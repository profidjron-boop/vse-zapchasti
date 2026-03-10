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

type ServiceRequest = {
  id: number;
  uuid: string;
  status: string;
  vehicle_type: string;
  service_type: string;
  name: string | null;
  phone: string;
  email: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_engine: string | null;
  vehicle_year: number | null;
  vin: string | null;
  mileage: number | null;
  description: string | null;
  install_with_part: boolean;
  requested_product_sku: string | null;
  requested_product_name: string | null;
  estimated_bundle_total: number | null;
  preferred_date: string | null;
  consent_given: boolean;
  created_at: string;
};

const FILTER_PRESETS_STORAGE_KEY = "admin_service_requests_filter_presets_v1";
export default function AdminServiceRequestsPage() {
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
  } = useAdminRequestListPage<ServiceRequest>({
    searchParams,
    router,
    basePath: "/admin/service-requests",
    storageKey: FILTER_PRESETS_STORAGE_KEY,
    fetchPath: "/api/admin/service-requests",
    fetchErrorMessage: "Ошибка загрузки заявок сервиса",
    bulkPath: (id) => `/api/admin/service-requests/${id}/status`,
    emptySelectionError: "Выберите хотя бы одну заявку",
    bulkFailedMessage: (failed) => `Не удалось обновить ${failed} заявок`,
  });

  const handleExportCsv = () => {
    if (requests.length === 0) {
      setError("Нет данных для экспорта");
      return;
    }

    const headers = [
      "ID",
      "Статус",
      "Тип авто",
      "Двигатель",
      "Услуга",
      "Связка",
      "SKU",
      "Товар",
      "Оценка комплекта",
      "Имя",
      "Телефон",
      "Email",
      "VIN",
      "Дата",
      "Согласие",
    ];
    const rows = requests.map((request) => [
      String(request.id),
      getBasicRequestStatusLabel(request.status),
      request.vehicle_type === "truck" ? "Грузовой" : "Легковой",
      request.vehicle_engine || "",
      request.service_type || "",
      request.install_with_part ? "Да" : "Нет",
      request.requested_product_sku || "",
      request.requested_product_name || "",
      typeof request.estimated_bundle_total === "number"
        ? request.estimated_bundle_total.toLocaleString("ru-RU")
        : "",
      request.name || "",
      request.phone || "",
      request.email || "",
      request.vin || "",
      new Date(request.created_at).toLocaleString("ru-RU"),
      request.consent_given ? "Да" : "Нет",
    ]);
    downloadCsv("service-requests", headers, rows);
    setSuccess("CSV экспортирован");
  };

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
        title="Заявки на сервис"
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRefresh={() => void refreshRequests(true)}
      />
      <RequestListFeedback error={error} success={success} />
      <RequestListFilters
        status={status}
        search={search}
        statusOptions={BASIC_REQUEST_STATUS_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        searchPlaceholder="Имя, телефон, SKU или товар"
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

      {requests.length === 0 ? (
        <RequestListEmptyState
          hasFilters={Boolean(appliedFilters.status || appliedFilters.search.trim())}
          filteredTitle="По выбранным фильтрам заявок сервиса не найдено"
          filteredSubtitle="Попробуйте изменить параметры поиска или сбросить фильтры"
          emptyTitle="Заявок пока нет"
          emptySubtitle="Заявки появятся здесь после отправки формы на сайте"
        />
      ) : (
        <RequestListDataLayout
          requestsCount={requests.length}
          page={page}
          selectedCount={selectedRequestIds.length}
          bulkStatus={bulkStatus}
          bulkStatusOptions={BASIC_REQUEST_STATUS_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
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
                      aria-label={`Выбрать заявку сервиса ${request.id}`}
                    />
                    <span>#{request.id}</span>
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        request.vehicle_type === "truck"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {request.vehicle_type === "truck"
                        ? "Грузовой"
                        : "Легковой"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${getBasicRequestStatusColor(request.status)}`}
                    >
                      {getBasicRequestStatusLabel(request.status)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1 text-sm text-neutral-700">
                <p>Услуга: {request.service_type}</p>
                <p>
                  Связка:{" "}
                  {request.install_with_part ? "Запчасть + установка" : "—"}
                </p>
                <p>SKU: {request.requested_product_sku || "—"}</p>
                <p>Телефон: {request.phone}</p>
                <p>Имя: {request.name || "—"}</p>
                <p>Двигатель: {request.vehicle_engine || "—"}</p>
                <p>Согласие: {request.consent_given ? "Да" : "Нет"}</p>
                <p className="text-xs text-neutral-500">
                  {new Date(request.created_at).toLocaleString("ru-RU")}
                </p>
              </div>

              <Link
                className="text-sm font-medium text-[#1F3B73] hover:underline"
                href={`/admin/service-requests/${request.id}`}
              >
                Открыть карточку
              </Link>
            </article>
          ))}
          desktopContent={
            <table className="w-full min-w-[1360px]">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Выбрать все заявки сервиса"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Тип авто
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Двигатель
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Услуга
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Связка
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Статус
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
                        aria-label={`Выбрать заявку сервиса ${request.id}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      #{request.id}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          request.vehicle_type === "truck"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {request.vehicle_type === "truck"
                          ? "Грузовой"
                          : "Легковой"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {request.vehicle_engine || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {request.service_type}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {request.install_with_part ? (
                        <span className="rounded-full bg-[#EEF3FF] px-2 py-1 text-xs text-[#1F3B73]">
                          Да
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {request.requested_product_sku || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${getBasicRequestStatusColor(request.status)}`}
                      >
                        {getBasicRequestStatusLabel(request.status)}
                      </span>
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
                        href={`/admin/service-requests/${request.id}`}
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
          jumpInputId="service-requests-page-jump"
          onPageInputChange={setPageInput}
          onPrevPage={() => setPage((prev) => Math.max(1, prev - 1))}
          onNextPage={() => setPage((prev) => prev + 1)}
          onJumpToPage={handlePageJump}
        />
      )}
    </div>
  );
}
