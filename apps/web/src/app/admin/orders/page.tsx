'use client';

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type OrderRow = {
  id: number;
  uuid: string;
  status: string;
  source: string;
  customer_name: string | null;
  customer_phone: string;
  customer_email: string | null;
  delivery_method: string | null;
  payment_method: string | null;
  created_at: string;
  items: Array<{ id: number }>;
};

const PAGE_SIZE = 25;

function normalizePage(value: string | null): number {
  const parsed = Number.parseInt(value || "1", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 1;
}

function statusLabel(value: string): string {
  if (value === "new") return "Новый";
  if (value === "in_progress") return "В работе";
  if (value === "ready") return "Готов";
  if (value === "closed") return "Закрыт";
  if (value === "canceled") return "Отменён";
  return value;
}

function sourceLabel(value: string): string {
  if (value === "checkout") return "Оформление";
  if (value === "one_click") return "Быстрый заказ";
  return value;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "";
  const initialSearch = (searchParams.get("q") || "").trim();
  const initialPage = normalizePage(searchParams.get("page"));
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState(initialSearch);
  const [appliedStatus, setAppliedStatus] = useState(initialStatus);
  const [appliedSearch, setAppliedSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [pageInput, setPageInput] = useState(String(initialPage));

  const fetchStatuses = useCallback(async () => {
    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const payload = await fetchJsonWithTimeout<string[]>(
        withApiBase(apiBaseUrl, "/api/admin/orders/statuses"),
        {},
        12000
      );
      if (Array.isArray(payload)) {
        setStatuses(payload);
      }
    } catch (statusError) {
      if (statusError instanceof ApiRequestError && (statusError.status === 401 || statusError.status === 403)) {
        router.push("/admin/login");
      }
    }
  }, [router]);

  const fetchOrders = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    }
    setError("");

    try {
      const query = new URLSearchParams({
        skip: String((page - 1) * PAGE_SIZE),
        limit: String(PAGE_SIZE + 1),
      });
      if (appliedStatus) query.set("status", appliedStatus);
      if (appliedSearch.trim()) query.set("search", appliedSearch.trim());

      const apiBaseUrl = getClientApiBaseUrl();
      const payload = await fetchJsonWithTimeout<OrderRow[]>(
        withApiBase(apiBaseUrl, `/api/admin/orders?${query.toString()}`),
        {},
        12000
      );
      const rows = Array.isArray(payload) ? payload : [];
      const nextPageAvailable = rows.length > PAGE_SIZE;
      const pageRows = nextPageAvailable ? rows.slice(0, PAGE_SIZE) : rows;
      setOrders(pageRows);
      setHasNextPage(nextPageAvailable);
      setLastUpdated(new Date().toLocaleTimeString("ru-RU"));
    } catch (fetchError) {
      if (fetchError instanceof ApiRequestError && (fetchError.status === 401 || fetchError.status === 403)) {
        router.push("/admin/login");
        return;
      }
      if (fetchError instanceof ApiRequestError) {
        setError(fetchError.traceId ? `${fetchError.message}. Код: ${fetchError.traceId}` : fetchError.message);
      } else {
        setError("Ошибка загрузки заказов");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appliedSearch, appliedStatus, page, router]);

  useEffect(() => {
    void fetchStatuses();
  }, [fetchStatuses]);

  useEffect(() => {
    const nextStatus = searchParams.get("status") || "";
    const nextSearch = (searchParams.get("q") || "").trim();
    const nextPage = normalizePage(searchParams.get("page"));

    setStatus((prev) => (prev === nextStatus ? prev : nextStatus));
    setSearch((prev) => (prev === nextSearch ? prev : nextSearch));
    setAppliedStatus((prev) => (prev === nextStatus ? prev : nextStatus));
    setAppliedSearch((prev) => (prev === nextSearch ? prev : nextSearch));
    setPage((prev) => (prev === nextPage ? prev : nextPage));
  }, [searchParams]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const query = new URLSearchParams();
    const normalizedSearch = appliedSearch.trim();
    if (appliedStatus) {
      query.set("status", appliedStatus);
    }
    if (normalizedSearch) {
      query.set("q", normalizedSearch);
    }
    if (page > 1) {
      query.set("page", String(page));
    }
    const target = query.toString() ? `/admin/orders?${query.toString()}` : "/admin/orders";
    router.replace(target, { scroll: false });
  }, [appliedSearch, appliedStatus, page, router]);

  function handleApplyFilters(event: React.FormEvent) {
    event.preventDefault();
    setAppliedStatus(status);
    setAppliedSearch(search);
    setPage(1);
  }

  function handleResetFilters() {
    setStatus("");
    setSearch("");
    setAppliedStatus("");
    setAppliedSearch("");
    setPage(1);
    setHasNextPage(false);
  }

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[#1F3B73]">Загрузка...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1F3B73]">Заказы</h1>
        <div className="flex items-center gap-3">
          {lastUpdated && <span className="text-xs text-neutral-500">Обновлено: {lastUpdated}</span>}
          <button
            type="button"
            onClick={() => void fetchOrders(true)}
            disabled={refreshing}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            {refreshing ? "Обновление..." : "Обновить"}
          </button>
        </div>
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
            {statuses.map((statusValue) => (
              <option key={statusValue} value={statusValue}>
                {statusLabel(statusValue)}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">Поиск</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Телефон, имя, email, UUID, ИНН"
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
            className="rounded-xl bg-[#1F3B73] px-5 py-2 text-sm font-medium text-white hover:bg-[#14294F]"
          >
            Применить
          </button>
        </div>
      </form>

      <div className="mb-6 min-h-[4.5rem]">
        {error ? (
          <div role="alert" aria-live="assertive" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        ) : null}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white py-12 text-center text-neutral-500">
          {appliedStatus || appliedSearch ? (
            <>
              <p>По выбранным фильтрам заказы не найдены</p>
              <p className="mt-2 text-sm">Попробуйте сбросить фильтры или изменить параметры поиска</p>
            </>
          ) : (
            <>
              <p>Заказов пока нет</p>
              <p className="mt-2 text-sm">Заказы появятся после оформления на сайте</p>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-4 py-3 text-sm text-neutral-500">
            Показано заказов: {orders.length} · Страница {page}
          </div>

          <div className="divide-y divide-neutral-200 md:hidden">
            {orders.map((order) => (
              <article key={order.id} className="space-y-3 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">#{order.id}</p>
                    <p className="mt-1 text-xs text-neutral-500">{sourceLabel(order.source)}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#1F3B73]/10 px-2 py-1 text-xs text-[#1F3B73]">
                    {statusLabel(order.status)}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm text-neutral-700">
                  <p>Клиент: {order.customer_name || "—"}</p>
                  <p>Телефон: {order.customer_phone}</p>
                  <p>Доставка/Оплата: {(order.delivery_method || "—")} / {(order.payment_method || "—")}</p>
                  <p>Позиции: {order.items.length}</p>
                  <p className="text-xs text-neutral-500">{new Date(order.created_at).toLocaleString("ru-RU")}</p>
                </div>

                <Link className="text-sm font-medium text-[#1F3B73] hover:underline" href={`/admin/orders/${order.id}`}>
                  Открыть карточку
                </Link>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Статус</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Источник</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Клиент</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Телефон</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Доставка/Оплата</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Позиции</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Дата</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Карточка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">#{order.id}</td>
                    <td className="px-4 py-3 text-sm">{statusLabel(order.status)}</td>
                    <td className="px-4 py-3 text-sm">{sourceLabel(order.source)}</td>
                    <td className="px-4 py-3 text-sm">{order.customer_name || "—"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{order.customer_phone}</td>
                    <td className="px-4 py-3 text-sm">
                      {(order.delivery_method || "—")} / {(order.payment_method || "—")}
                    </td>
                    <td className="px-4 py-3 text-sm">{order.items.length}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{new Date(order.created_at).toLocaleString("ru-RU")}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <Link className="text-[#1F3B73] hover:underline" href={`/admin/orders/${order.id}`}>
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-sm">
            <div className="text-neutral-500">
              Поиск работает по всем заказам, не только по текущей странице.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || refreshing}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
              >
                Назад
              </button>
              <span className="min-w-[5rem] text-center text-neutral-600">Стр. {page}</span>
              <button
                type="button"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={!hasNextPage || refreshing}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
              >
                Вперёд
              </button>
              <form onSubmit={handlePageJump} className="ml-1 flex items-center gap-2">
                <label htmlFor="orders-page-jump" className="text-xs text-neutral-500">Стр.</label>
                <input
                  id="orders-page-jump"
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
      )}
    </div>
  );
}
