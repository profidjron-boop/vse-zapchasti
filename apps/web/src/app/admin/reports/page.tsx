'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type LeadReportItem = {
  id: number;
  status: string;
  created_at: string;
};

type VinReportItem = {
  id: number;
  status: string;
  created_at: string;
};

type ServiceReportItem = {
  id: number;
  status: string;
  created_at: string;
};

type OrderReportItem = {
  id: number;
  status: string;
  created_at: string;
};

type ProductReportItem = {
  id: number;
  is_active: boolean;
  stock_quantity: number;
};

type CategoryReportItem = {
  id: number;
  is_active: boolean;
};

function groupStatusCounts(items: Array<{ status: string }>): Array<{ status: string; count: number }> {
  const counters = new Map<string, number>();
  for (const item of items) {
    const status = item.status || "unknown";
    counters.set(status, (counters.get(status) ?? 0) + 1);
  }

  return Array.from(counters.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

function statusLabel(status: string): string {
  if (status === "new") return "Новая";
  if (status === "in_progress") return "В работе";
  if (status === "offer_sent") return "Предложение отправлено";
  if (status === "won") return "Успешно";
  if (status === "lost") return "Неуспешно";
  if (status === "closed") return "Закрыта";
  if (status === "canceled" || status === "cancelled") return "Отменена";
  if (status === "scheduled") return "Запланирована";
  if (status === "contacted") return "Связались";
  return status;
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const [leads, setLeads] = useState<LeadReportItem[]>([]);
  const [vinRequests, setVinRequests] = useState<VinReportItem[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceReportItem[]>([]);
  const [orders, setOrders] = useState<OrderReportItem[]>([]);
  const [products, setProducts] = useState<ProductReportItem[]>([]);
  const [categories, setCategories] = useState<CategoryReportItem[]>([]);

  const fetchReports = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    }
    setError("");

    try {
      const apiBaseUrl = getClientApiBaseUrl();

      const endpoints = [
        "/api/admin/leads?limit=100",
        "/api/admin/vin-requests?limit=100",
        "/api/admin/service-requests?limit=100",
        "/api/admin/orders?limit=100",
        "/api/admin/products?limit=100",
        "/api/admin/categories",
      ];

      const failedSections: string[] = [];

      const parseArray = async <T,>(endpoint: string, sectionLabel: string): Promise<T[]> => {
        try {
          const payload = await fetchJsonWithTimeout<T[]>(
            withApiBase(apiBaseUrl, endpoint),
            {},
            12000
          );
          return Array.isArray(payload) ? payload : [];
        } catch (sectionError) {
          if (sectionError instanceof ApiRequestError && (sectionError.status === 401 || sectionError.status === 403)) {
            throw sectionError;
          }
          if (sectionError instanceof ApiRequestError && sectionError.traceId) {
            failedSections.push(`${sectionLabel} (Код: ${sectionError.traceId})`);
          } else {
            failedSections.push(sectionLabel);
          }
          return [];
        }
      };

      const [leadsData, vinData, serviceData, ordersData, productsData, categoriesData] = await Promise.all([
        parseArray<LeadReportItem>(endpoints[0], "заявки"),
        parseArray<VinReportItem>(endpoints[1], "VIN-заявки"),
        parseArray<ServiceReportItem>(endpoints[2], "сервис"),
        parseArray<OrderReportItem>(endpoints[3], "заказы"),
        parseArray<ProductReportItem>(endpoints[4], "товары"),
        parseArray<CategoryReportItem>(endpoints[5], "категории"),
      ]);

      setLeads(leadsData);
      setVinRequests(vinData);
      setServiceRequests(serviceData);
      setOrders(ordersData);
      setProducts(productsData);
      setCategories(categoriesData);
      if (failedSections.length > 0) {
        setError(`Часть разделов не загрузилась: ${failedSections.join(", ")}`);
      }
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
        setError("Ошибка загрузки отчётов");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const activeProducts = useMemo(
    () => products.filter((product) => product.is_active).length,
    [products]
  );
  const inStockProducts = useMemo(
    () => products.filter((product) => product.stock_quantity > 0).length,
    [products]
  );
  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active).length,
    [categories]
  );

  const leadStatusRows = useMemo(() => groupStatusCounts(leads), [leads]);
  const vinStatusRows = useMemo(() => groupStatusCounts(vinRequests), [vinRequests]);
  const serviceStatusRows = useMemo(() => groupStatusCounts(serviceRequests), [serviceRequests]);
  const orderStatusRows = useMemo(() => groupStatusCounts(orders), [orders]);

  const latestLeads = useMemo(
    () =>
      [...leads]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10),
    [leads]
  );

  const latestOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10),
    [orders]
  );

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
        <div>
          <h1 className="text-2xl font-bold text-[#1F3B73]">Отчёты</h1>
          <p className="mt-1 text-sm text-neutral-600">Минимальная операционная сводка по каталогу и заявкам.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && <span className="text-xs text-neutral-500">Обновлено: {lastUpdated}</span>}
          <button
            type="button"
            onClick={() => void fetchReports(true)}
            disabled={refreshing}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            {refreshing ? "Обновление..." : "Обновить"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm text-neutral-600">Заявки (запчасти)</div>
          <div className="mt-2 text-2xl font-bold text-[#1F3B73]">{leads.length}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm text-neutral-600">VIN-заявки</div>
          <div className="mt-2 text-2xl font-bold text-[#1F3B73]">{vinRequests.length}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm text-neutral-600">Заявки (сервис)</div>
          <div className="mt-2 text-2xl font-bold text-[#1F3B73]">{serviceRequests.length}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm text-neutral-600">Заказы</div>
          <div className="mt-2 text-2xl font-bold text-[#1F3B73]">{orders.length}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm text-neutral-600">Товары (всего)</div>
          <div className="mt-2 text-2xl font-bold text-[#1F3B73]">{products.length}</div>
          <div className="mt-1 text-xs text-neutral-500">Активные: {activeProducts}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm text-neutral-600">Товары в наличии</div>
          <div className="mt-2 text-2xl font-bold text-[#1F3B73]">{inStockProducts}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm text-neutral-600">Категории</div>
          <div className="mt-2 text-2xl font-bold text-[#1F3B73]">{categories.length}</div>
          <div className="mt-1 text-xs text-neutral-500">Активные: {activeCategories}</div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold text-[#1F3B73]">Статусы заявок (запчасти)</h2>
          {leadStatusRows.length === 0 ? (
            <p className="text-sm text-neutral-500">Нет данных</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {leadStatusRows.map((row) => (
                <li key={row.status} className="flex items-center justify-between">
                  <span>{statusLabel(row.status)}</span>
                  <span className="font-medium text-[#1F3B73]">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold text-[#1F3B73]">Статусы VIN-заявок</h2>
          {vinStatusRows.length === 0 ? (
            <p className="text-sm text-neutral-500">Нет данных</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {vinStatusRows.map((row) => (
                <li key={row.status} className="flex items-center justify-between">
                  <span>{statusLabel(row.status)}</span>
                  <span className="font-medium text-[#1F3B73]">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold text-[#1F3B73]">Статусы заявок сервиса</h2>
          {serviceStatusRows.length === 0 ? (
            <p className="text-sm text-neutral-500">Нет данных</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {serviceStatusRows.map((row) => (
                <li key={row.status} className="flex items-center justify-between">
                  <span>{statusLabel(row.status)}</span>
                  <span className="font-medium text-[#1F3B73]">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold text-[#1F3B73]">Статусы заказов</h2>
          {orderStatusRows.length === 0 ? (
            <p className="text-sm text-neutral-500">Нет данных</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {orderStatusRows.map((row) => (
                <li key={row.status} className="flex items-center justify-between">
                  <span>{statusLabel(row.status)}</span>
                  <span className="font-medium text-[#1F3B73]">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-[#1F3B73]">Последние заявки (запчасти)</h2>
        {latestLeads.length === 0 ? (
          <p className="text-sm text-neutral-500">Нет данных</p>
        ) : (
          <div>
            <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 md:hidden">
              {latestLeads.map((lead) => (
                <article key={lead.id} className="space-y-1 px-3 py-3 text-sm">
                  <p className="font-medium text-neutral-900">#{lead.id}</p>
                  <p className="text-neutral-700">{statusLabel(lead.status)}</p>
                  <p className="text-xs text-neutral-500">{new Date(lead.created_at).toLocaleString("ru-RU")}</p>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-neutral-500">ID</th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-neutral-500">Статус</th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-neutral-500">Создана</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-sm">
                  {latestLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="px-3 py-2">#{lead.id}</td>
                      <td className="px-3 py-2">{statusLabel(lead.status)}</td>
                      <td className="px-3 py-2">{new Date(lead.created_at).toLocaleString("ru-RU")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-[#1F3B73]">Последние заказы</h2>
        {latestOrders.length === 0 ? (
          <p className="text-sm text-neutral-500">Нет данных</p>
        ) : (
          <div>
            <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 md:hidden">
              {latestOrders.map((order) => (
                <article key={order.id} className="space-y-1 px-3 py-3 text-sm">
                  <p className="font-medium text-neutral-900">#{order.id}</p>
                  <p className="text-neutral-700">{statusLabel(order.status)}</p>
                  <p className="text-xs text-neutral-500">{new Date(order.created_at).toLocaleString("ru-RU")}</p>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-neutral-500">ID</th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-neutral-500">Статус</th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-neutral-500">Создан</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-sm">
                  {latestOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-3 py-2">#{order.id}</td>
                      <td className="px-3 py-2">{statusLabel(order.status)}</td>
                      <td className="px-3 py-2">{new Date(order.created_at).toLocaleString("ru-RU")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
