'use client';

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

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

type ServiceRequestFilters = {
  status: string;
  search: string;
};

type FilterPreset = {
  id: string;
  name: string;
  filters: ServiceRequestFilters;
};

const FILTER_PRESETS_STORAGE_KEY = "admin_service_requests_filter_presets_v1";
const DEFAULT_PAGE_SIZE = 25;

function normalizePage(value: string | null): number {
  const parsed = Number.parseInt(value || "1", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 1;
}

function normalizePageSize(value: string | null): number {
  const parsed = Number.parseInt(value || "", 10);
  if (parsed === 25 || parsed === 50 || parsed === 100) {
    return parsed;
  }
  return DEFAULT_PAGE_SIZE;
}

export default function AdminServiceRequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "";
  const initialSearch = (searchParams.get("q") || "").trim();
  const initialPage = normalizePage(searchParams.get("page"));
  const initialPageSize = normalizePageSize(searchParams.get("page_size"));
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState(initialSearch);
  const [appliedFilters, setAppliedFilters] = useState<ServiceRequestFilters>({
    status: initialStatus,
    search: initialSearch,
  });
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [selectedRequestIds, setSelectedRequestIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const fetchServiceRequests = useCallback(async (showRefreshing = false) => {
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
      if (appliedFilters.status) query.set("status", appliedFilters.status);
      if (appliedFilters.search.trim()) query.set("search", appliedFilters.search.trim());

      const data = await fetchJsonWithTimeout<ServiceRequest[]>(
        withApiBase(apiBaseUrl, `/api/admin/service-requests?${query.toString()}`),
        {},
        12000
      );
      const nextPageAvailable = data.length > pageSize;
      const pageRows = nextPageAvailable ? data.slice(0, pageSize) : data;
      setRequests(pageRows);
      setHasNextPage(nextPageAvailable);
      setSelectedRequestIds((prev) => prev.filter((id) => pageRows.some((request) => request.id === id)));
      setLastUpdated(new Date().toLocaleTimeString("ru-RU"));
    } catch (fetchError) {
      if (fetchError instanceof ApiRequestError && (fetchError.status === 401 || fetchError.status === 403)) {
        router.push("/admin/login");
        return;
      }
      if (fetchError instanceof ApiRequestError) {
        setError(fetchError.traceId ? `${fetchError.message}. Код: ${fetchError.traceId}` : fetchError.message);
      } else {
        setError("Ошибка загрузки заявок сервиса");
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [appliedFilters.search, appliedFilters.status, page, pageSize, router]);

  useEffect(() => {
    void fetchServiceRequests();
  }, [fetchServiceRequests]);

  useEffect(() => {
    const nextStatus = searchParams.get("status") || "";
    const nextSearch = (searchParams.get("q") || "").trim();
    const nextPage = normalizePage(searchParams.get("page"));
    const nextPageSize = normalizePageSize(searchParams.get("page_size"));

    setStatus((prev) => (prev === nextStatus ? prev : nextStatus));
    setSearch((prev) => (prev === nextSearch ? prev : nextSearch));
    setAppliedFilters((prev) => (
      prev.status === nextStatus && prev.search === nextSearch
        ? prev
        : { status: nextStatus, search: nextSearch }
    ));
    setPage((prev) => (prev === nextPage ? prev : nextPage));
    setPageSize((prev) => (prev === nextPageSize ? prev : nextPageSize));
  }, [searchParams]);

  useEffect(() => {
    const query = new URLSearchParams();
    const normalizedSearch = appliedFilters.search.trim();
    if (appliedFilters.status) {
      query.set("status", appliedFilters.status);
    }
    if (normalizedSearch) {
      query.set("q", normalizedSearch);
    }
    if (pageSize !== DEFAULT_PAGE_SIZE) {
      query.set("page_size", String(pageSize));
    }
    if (page > 1) {
      query.set("page", String(page));
    }
    const target = query.toString() ? `/admin/service-requests?${query.toString()}` : "/admin/service-requests";
    router.replace(target, { scroll: false });
  }, [appliedFilters.search, appliedFilters.status, page, pageSize, router]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_PRESETS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as FilterPreset[];
      if (Array.isArray(parsed)) {
        setPresets(parsed);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  function handleApplyFilters(event: React.FormEvent) {
    event.preventDefault();
    setAppliedFilters({ status, search });
    setPage(1);
  }

  function handleResetFilters() {
    setStatus("");
    setSearch("");
    setAppliedFilters({ status: "", search: "" });
    setPage(1);
    setError("");
  }

  function handlePageJump(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number.parseInt(pageInput, 10);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(page));
      return;
    }
    const nextPage = Math.max(1, parsed);
    setPage(nextPage);
    setPageInput(String(nextPage));
  }

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) {
      setError("Введите имя пресета");
      return;
    }
    const preset: FilterPreset = {
      id: `${Date.now()}`,
      name,
      filters: { status, search },
    };
    const next = [preset, ...presets];
    setPresets(next);
    setPresetName("");
    localStorage.setItem(FILTER_PRESETS_STORAGE_KEY, JSON.stringify(next));
    setSuccess(`Пресет "${name}" сохранён`);
  };

  const handleApplyPreset = () => {
    const preset = presets.find((item) => item.id === selectedPresetId);
    if (!preset) {
      setError("Выберите пресет");
      return;
    }
    setStatus(preset.filters.status);
    setSearch(preset.filters.search);
    setAppliedFilters(preset.filters);
    setPage(1);
    setSuccess(`Применён пресет "${preset.name}"`);
  };

  const handleDeletePreset = () => {
    if (!selectedPresetId) {
      setError("Выберите пресет для удаления");
      return;
    }
    const next = presets.filter((item) => item.id !== selectedPresetId);
    setPresets(next);
    setSelectedPresetId("");
    localStorage.setItem(FILTER_PRESETS_STORAGE_KEY, JSON.stringify(next));
    setSuccess("Пресет удалён");
  };

  async function handleBulkStatusUpdate() {
    if (selectedRequestIds.length === 0) {
      setError("Выберите хотя бы одну заявку");
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
      const apiBaseUrl = getClientApiBaseUrl();
      let updated = 0;
      let failed = 0;
      let firstError = "";

      for (const requestId of selectedRequestIds) {
        try {
          await fetchJsonWithTimeout<ServiceRequest>(
            withApiBase(apiBaseUrl, `/api/admin/service-requests/${requestId}/status`),
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ status: bulkStatus, operator_comment: null }),
            },
            12000
          );
          updated += 1;
        } catch (updateError) {
          if (updateError instanceof ApiRequestError && (updateError.status === 401 || updateError.status === 403)) {
            router.push("/admin/login");
            return;
          }
          failed += 1;
          if (!firstError) {
            if (updateError instanceof ApiRequestError) {
              firstError = updateError.traceId
                ? `${updateError.message}. Код: ${updateError.traceId}`
                : updateError.message;
            } else {
              firstError = `Ошибка обновления ID ${requestId}`;
            }
          }
        }
      }

      if (updated > 0) {
        setSuccess(`Обновлено: ${updated}. Ошибок: ${failed}.`);
      }
      if (failed > 0) {
        setError(firstError || `Не удалось обновить ${failed} заявок`);
      }

      setSelectedRequestIds([]);
      setBulkStatus("");
      await fetchServiceRequests(true);
    } finally {
      setBulkUpdating(false);
    }
  }

  const allSelected = requests.length > 0 && selectedRequestIds.length === requests.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedRequestIds([]);
      return;
    }
    setSelectedRequestIds(requests.map((request) => request.id));
  };

  const toggleSelectRequest = (requestId: number) => {
    setSelectedRequestIds((prev) =>
      prev.includes(requestId)
        ? prev.filter((id) => id !== requestId)
        : [...prev, requestId]
    );
  };

  const getStatusLabel = (requestStatus: string) => {
    if (requestStatus === "new") return "Новая";
    if (requestStatus === "in_progress") return "В работе";
    if (requestStatus === "closed") return "Закрыта";
    return requestStatus;
  };

  const getStatusColor = (requestStatus: string) => {
    if (requestStatus === "new") return "bg-blue-100 text-blue-700";
    if (requestStatus === "in_progress") return "bg-amber-100 text-amber-700";
    if (requestStatus === "closed") return "bg-green-100 text-green-700";
    return "bg-neutral-100 text-neutral-700";
  };

  const toCsvCell = (value: string) => {
    const normalized = value.replace(/"/g, '""');
    return /[;"\n]/.test(normalized) ? `"${normalized}"` : normalized;
  };

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
      getStatusLabel(request.status),
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

    const csv = [
      headers.map(toCsvCell).join(";"),
      ...rows.map((row) => row.map(toCsvCell).join(";")),
    ].join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateLabel = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `service-requests-${dateLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
      <h1 className="mb-6 text-2xl font-bold text-[#1F3B73]">Заявки на сервис</h1>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {lastUpdated ? (
          <div className="text-xs text-neutral-500">Обновлено: {lastUpdated}</div>
        ) : (
          <div />
        )}
        <button
          type="button"
          onClick={() => void fetchServiceRequests(true)}
          disabled={isRefreshing}
          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          {isRefreshing ? "Обновление..." : "Обновить"}
        </button>
      </div>

      <div className="mb-6 min-h-[4.5rem]">
        {error ? (
          <div role="alert" aria-live="assertive" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        ) : null}
        {!error && success ? (
          <div role="status" aria-live="polite" className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {success}
          </div>
        ) : null}
      </div>

      <form onSubmit={handleApplyFilters} className="mb-6 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">Статус</label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          >
            <option value="">Все</option>
            <option value="new">Новая</option>
            <option value="in_progress">В работе</option>
            <option value="closed">Закрыта</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">Поиск</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Имя, телефон, SKU или товар"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          />
        </div>
        <div className="md:col-span-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleResetFilters}
            className="rounded-xl border border-neutral-300 bg-white px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Сбросить
          </button>
          <button
            type="submit"
            disabled={isRefreshing}
            className="rounded-xl bg-[#1F3B73] px-5 py-2 text-sm font-medium text-white hover:bg-[#14294F] disabled:opacity-50"
          >
            {isRefreshing ? "Загрузка..." : "Применить"}
          </button>
        </div>
      </form>
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_auto_auto]">
          <input
            type="text"
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            placeholder="Имя пресета фильтров"
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          />
          <select
            value={selectedPresetId}
            onChange={(event) => setSelectedPresetId(event.target.value)}
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          >
            <option value="">Выберите пресет</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSavePreset}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Сохранить пресет
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplyPreset}
              className="rounded-xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#14294F]"
            >
              Применить
            </button>
            <button
              type="button"
              onClick={handleDeletePreset}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white py-12 text-center text-neutral-500">
          {appliedFilters.status || appliedFilters.search.trim() ? (
            <>
              <p>По выбранным фильтрам заявок сервиса не найдено</p>
              <p className="mt-2 text-sm">Попробуйте изменить параметры поиска или сбросить фильтры</p>
            </>
          ) : (
            <>
              <p>Заявок пока нет</p>
              <p className="mt-2 text-sm">Заявки появятся здесь после отправки формы на сайте</p>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-neutral-500">Показано на странице: {requests.length} · Страница {page}</div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm text-neutral-600">Выбрано: {selectedRequestIds.length}</div>
                <select
                  value={bulkStatus}
                  onChange={(event) => setBulkStatus(event.target.value)}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
                >
                  <option value="">Статус для выбранных</option>
                  <option value="new">Новая</option>
                  <option value="in_progress">В работе</option>
                  <option value="closed">Закрыта</option>
                </select>
                <button
                  type="button"
                  onClick={() => void handleBulkStatusUpdate()}
                  disabled={bulkUpdating || selectedRequestIds.length === 0 || !bulkStatus}
                  className="rounded-xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#14294F] disabled:opacity-50"
                >
                  {bulkUpdating ? "Обновление..." : "Применить к выбранным"}
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                >
                  Экспорт CSV
                </button>
                  <select
                  value={String(pageSize)}
                  onChange={(event) => {
                    setPageSize(normalizePageSize(event.target.value));
                    setPage(1);
                  }}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
                >
                  <option value="25">25 на странице</option>
                  <option value="50">50 на странице</option>
                  <option value="100">100 на странице</option>
                </select>
              </div>
            </div>
          </div>

          <div className="divide-y divide-neutral-200 md:hidden">
            {requests.map((request) => (
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
                        {request.vehicle_type === "truck" ? "Грузовой" : "Легковой"}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-xs ${getStatusColor(request.status)}`}>
                        {getStatusLabel(request.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1 text-sm text-neutral-700">
                  <p>Услуга: {request.service_type}</p>
                  <p>Связка: {request.install_with_part ? "Запчасть + установка" : "—"}</p>
                  <p>SKU: {request.requested_product_sku || "—"}</p>
                  <p>Телефон: {request.phone}</p>
                  <p>Имя: {request.name || "—"}</p>
                  <p>Двигатель: {request.vehicle_engine || "—"}</p>
                  <p>Согласие: {request.consent_given ? "Да" : "Нет"}</p>
                  <p className="text-xs text-neutral-500">{new Date(request.created_at).toLocaleString("ru-RU")}</p>
                </div>

                <Link className="text-sm font-medium text-[#1F3B73] hover:underline" href={`/admin/service-requests/${request.id}`}>
                  Открыть карточку
                </Link>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Тип авто</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Двигатель</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Услуга</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Связка</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">SKU</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Статус</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Телефон</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Имя</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Согласие</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Дата</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Карточка</th>
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
                    <td className="px-4 py-3 text-sm whitespace-nowrap">#{request.id}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          request.vehicle_type === "truck"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {request.vehicle_type === "truck" ? "Грузовой" : "Легковой"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{request.vehicle_engine || "—"}</td>
                    <td className="px-4 py-3 text-sm">{request.service_type}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {request.install_with_part ? (
                        <span className="rounded-full bg-[#EEF3FF] px-2 py-1 text-xs text-[#1F3B73]">Да</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{request.requested_product_sku || "—"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-1 text-xs ${getStatusColor(request.status)}`}>
                        {getStatusLabel(request.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{request.phone}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{request.name || "—"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{request.consent_given ? "Да" : "Нет"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {new Date(request.created_at).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <Link className="text-[#1F3B73] hover:underline" href={`/admin/service-requests/${request.id}`}>
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-neutral-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-neutral-500">Страница: {page}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1 || isRefreshing}
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                >
                  Назад
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={!hasNextPage || isRefreshing}
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                >
                  Вперёд
                </button>
                <form onSubmit={handlePageJump} className="ml-1 flex items-center gap-2">
                  <label htmlFor="service-requests-page-jump" className="text-xs text-neutral-500">Стр.</label>
                  <input
                    id="service-requests-page-jump"
                    type="number"
                    min={1}
                    value={pageInput}
                    onChange={(event) => setPageInput(event.target.value)}
                    className="w-20 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-700 focus:border-[#1F3B73] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100"
                  >
                    Перейти
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
