'use client';

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const fetchStatuses = useCallback(async () => {
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) return;
      const apiBaseUrl = getClientApiBaseUrl();
      const payload = await fetchJsonWithTimeout<string[]>(
        withApiBase(apiBaseUrl, "/api/admin/orders/statuses"),
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        12000
      );
      if (Array.isArray(payload)) {
        setStatuses(payload);
      }
    } catch (statusError) {
      if (statusError instanceof ApiRequestError && (statusError.status === 401 || statusError.status === 403)) {
        localStorage.removeItem("admin_token");
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
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin/login");
        return;
      }

      const query = new URLSearchParams({ limit: "100" });
      if (appliedStatus) query.set("status", appliedStatus);
      if (appliedSearch.trim()) query.set("search", appliedSearch.trim());

      const apiBaseUrl = getClientApiBaseUrl();
      const payload = await fetchJsonWithTimeout<OrderRow[]>(
        withApiBase(apiBaseUrl, `/api/admin/orders?${query.toString()}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        12000
      );
      setOrders(Array.isArray(payload) ? payload : []);
      setLastUpdated(new Date().toLocaleTimeString("ru-RU"));
    } catch (fetchError) {
      if (fetchError instanceof ApiRequestError && (fetchError.status === 401 || fetchError.status === 403)) {
        localStorage.removeItem("admin_token");
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
  }, [appliedSearch, appliedStatus, router]);

  useEffect(() => {
    void fetchStatuses();
  }, [fetchStatuses]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  function handleApplyFilters(event: React.FormEvent) {
    event.preventDefault();
    setAppliedStatus(status);
    setAppliedSearch(search);
  }

  function handleResetFilters() {
    setStatus("");
    setSearch("");
    setAppliedStatus("");
    setAppliedSearch("");
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

      {error && (
        <div role="alert" aria-live="assertive" className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white py-12 text-center text-neutral-500">
          <p>Заказов пока нет</p>
          <p className="mt-2 text-sm">Заказы появятся после оформления на сайте</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-4 py-3 text-sm text-neutral-500">
            Найдено заказов: {orders.length}
          </div>
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
      )}
    </div>
  );
}
