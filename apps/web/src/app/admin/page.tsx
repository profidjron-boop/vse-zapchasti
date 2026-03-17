"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import {
  redirectIfAdminUnauthorized,
  toAdminErrorMessage,
} from "@/components/admin/api-error";
import { fetchJsonWithTimeout } from "@/lib/fetch-json";

type DashboardStatus = "loading" | "ready" | "empty" | "error";
type StatKey =
  | "leads"
  | "orders"
  | "vin"
  | "service"
  | "products"
  | "categories"
  | "content";

type StatCardState = {
  status: DashboardStatus;
  count: number | null;
  text: string;
};

type StatConfig = {
  key: StatKey;
  label: string;
  endpoint: string;
  mode: "paginated" | "array";
};

type NotificationKey = "leads" | "orders" | "vin" | "service";

type NotificationPreviewItem = {
  id: number;
  title: string;
  subtitle: string;
  createdAt: string;
  href: string;
};

type NotificationCardState = {
  status: DashboardStatus;
  count: number | null;
  text: string;
  label: string;
  href: string;
  items: NotificationPreviewItem[];
};

type LeadNotificationRow = {
  id: number;
  name: string | null;
  phone: string;
  type: string | null;
  created_at: string;
};

type OrderNotificationRow = {
  id: number;
  customer_name: string | null;
  customer_phone: string;
  source: string;
  created_at: string;
};

type VinNotificationRow = {
  id: number;
  vin: string;
  name: string | null;
  phone: string;
  created_at: string;
};

type ServiceNotificationRow = {
  id: number;
  service_type: string;
  vehicle_type: string;
  name: string | null;
  phone: string;
  created_at: string;
};

const API_PAGE_LIMIT = 100;
const MAX_COUNT_PAGES = 200;

const statConfigs: StatConfig[] = [
  {
    key: "leads",
    label: "Заявки (запчасти)",
    endpoint: "/api/admin/leads",
    mode: "paginated",
  },
  {
    key: "orders",
    label: "Заказы",
    endpoint: "/api/admin/orders",
    mode: "paginated",
  },
  {
    key: "vin",
    label: "VIN-заявки",
    endpoint: "/api/admin/vin-requests",
    mode: "paginated",
  },
  {
    key: "service",
    label: "Заявки (сервис)",
    endpoint: "/api/admin/service-requests",
    mode: "paginated",
  },
  {
    key: "products",
    label: "Товары",
    endpoint: "/api/admin/products",
    mode: "paginated",
  },
  {
    key: "categories",
    label: "Категории",
    endpoint: "/api/admin/categories",
    mode: "array",
  },
  {
    key: "content",
    label: "Контент-блоки",
    endpoint: "/api/admin/content",
    mode: "array",
  },
];

const initialStats: Record<StatKey, StatCardState> = {
  leads: { status: "loading", count: null, text: "Загрузка..." },
  orders: { status: "loading", count: null, text: "Загрузка..." },
  vin: { status: "loading", count: null, text: "Загрузка..." },
  service: { status: "loading", count: null, text: "Загрузка..." },
  products: { status: "loading", count: null, text: "Загрузка..." },
  categories: { status: "loading", count: null, text: "Загрузка..." },
  content: { status: "loading", count: null, text: "Загрузка..." },
};

const initialNotifications: Record<NotificationKey, NotificationCardState> = {
  leads: {
    status: "loading",
    count: null,
    text: "Загрузка...",
    label: "Новые заявки (запчасти)",
    href: "/admin/leads?status=new",
    items: [],
  },
  orders: {
    status: "loading",
    count: null,
    text: "Загрузка...",
    label: "Новые заказы",
    href: "/admin/orders?status=new",
    items: [],
  },
  vin: {
    status: "loading",
    count: null,
    text: "Загрузка...",
    label: "Новые VIN-заявки",
    href: "/admin/vin-requests?status=new",
    items: [],
  },
  service: {
    status: "loading",
    count: null,
    text: "Загрузка...",
    label: "Новые заявки (сервис)",
    href: "/admin/service-requests?status=new",
    items: [],
  },
};

function toCardState(count: number): StatCardState {
  if (count <= 0) {
    return { status: "empty", count: 0, text: "Пока пусто" };
  }
  return { status: "ready", count, text: "Данные доступны" };
}

function parseTimeValue(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function toNotificationCardState<T extends { id: number; created_at: string }>(
  base: NotificationCardState,
  rows: T[],
  toTitle: (row: T) => string,
  toSubtitle: (row: T) => string,
  toHref: (row: T) => string,
): NotificationCardState {
  if (rows.length <= 0) {
    return {
      ...base,
      status: "empty",
      count: 0,
      text: "Новых записей нет",
      items: [],
    };
  }

  const sorted = [...rows].sort(
    (left, right) => parseTimeValue(right.created_at) - parseTimeValue(left.created_at),
  );
  const items: NotificationPreviewItem[] = sorted.slice(0, 5).map((row) => ({
    id: row.id,
    title: toTitle(row),
    subtitle: toSubtitle(row),
    createdAt: row.created_at,
    href: toHref(row),
  }));

  return {
    ...base,
    status: "ready",
    count: rows.length,
    text: `Новых: ${rows.length}`,
    items,
  };
}

function withPagination(endpoint: string, skip: number, limit: number): string {
  const [path, rawQuery = ""] = endpoint.split("?");
  const params = new URLSearchParams(rawQuery);
  params.set("skip", String(skip));
  params.set("limit", String(limit));
  return `${path}?${params.toString()}`;
}

async function fetchPaginatedCount(
  apiBaseUrl: string,
  endpoint: string,
): Promise<number> {
  let total = 0;

  for (let pageIndex = 0; pageIndex < MAX_COUNT_PAGES; pageIndex += 1) {
    const pagedEndpoint = withPagination(
      endpoint,
      pageIndex * API_PAGE_LIMIT,
      API_PAGE_LIMIT,
    );
    const payload = await fetchJsonWithTimeout<unknown>(
      withApiBase(apiBaseUrl, pagedEndpoint),
      { credentials: "include" },
      12000,
    );
    if (!Array.isArray(payload)) {
      throw new Error("Некорректный формат ответа");
    }

    total += payload.length;
    if (payload.length < API_PAGE_LIMIT) {
      break;
    }
  }

  return total;
}

async function fetchStatusRows<T>(
  apiBaseUrl: string,
  endpoint: string,
): Promise<T[]> {
  const payload = await fetchJsonWithTimeout<unknown>(
    withApiBase(apiBaseUrl, endpoint),
    { credentials: "include" },
    12000,
  );
  if (!Array.isArray(payload)) {
    throw new Error("Некорректный формат ответа");
  }
  return payload as T[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] =
    useState<Record<StatKey, StatCardState>>(initialStats);
  const [notifications, setNotifications] = useState<
    Record<NotificationKey, NotificationCardState>
  >(initialNotifications);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async (showRefreshing = false) => {
      if (showRefreshing) {
        setIsRefreshing(true);
      }

      try {
        const apiBaseUrl = getClientApiBaseUrl();
        const loadNotificationBucket = async <TRow,>(
          endpoint: string,
        ): Promise<{ rows: TRow[]; error: string | null }> => {
          try {
            const rows = await fetchStatusRows<TRow>(apiBaseUrl, endpoint);
            return { rows, error: null };
          } catch (notificationError) {
            if (redirectIfAdminUnauthorized(notificationError, router)) {
              throw notificationError;
            }
            return {
              rows: [],
              error: toAdminErrorMessage(notificationError, "API недоступно"),
            };
          }
        };

        const entries = await Promise.all(
          statConfigs.map(async (config) => {
            try {
              if (config.mode === "array") {
                const payload = await fetchJsonWithTimeout<unknown>(
                  withApiBase(apiBaseUrl, config.endpoint),
                  { credentials: "include" },
                  12000,
                );
                if (!Array.isArray(payload)) {
                  return [
                    config.key,
                    {
                      status: "error",
                      count: null,
                      text: "Некорректный ответ API",
                    },
                  ] as const;
                }
                return [config.key, toCardState(payload.length)] as const;
              }

              const count = await fetchPaginatedCount(
                apiBaseUrl,
                config.endpoint,
              );
              return [config.key, toCardState(count)] as const;
            } catch (fetchError) {
              if (redirectIfAdminUnauthorized(fetchError, router)) {
                throw fetchError;
              }
              return [
                config.key,
                {
                  status: "error",
                  count: null,
                  text: toAdminErrorMessage(fetchError, "API недоступно"),
                },
              ] as const;
            }
          }),
        );
        const [leadsResult, ordersResult, vinResult, serviceResult] =
          await Promise.all([
            loadNotificationBucket<LeadNotificationRow>(
              "/api/admin/leads?status=new&limit=100",
            ),
            loadNotificationBucket<OrderNotificationRow>(
              "/api/admin/orders?status=new&limit=100",
            ),
            loadNotificationBucket<VinNotificationRow>(
              "/api/admin/vin-requests?status=new&limit=100",
            ),
            loadNotificationBucket<ServiceNotificationRow>(
              "/api/admin/service-requests?status=new&limit=100",
            ),
          ]);

        if (cancelled) {
          return;
        }

        setStats(Object.fromEntries(entries) as Record<StatKey, StatCardState>);
        setNotifications({
          leads: leadsResult.error
            ? {
                ...initialNotifications.leads,
                status: "error",
                count: null,
                text: leadsResult.error,
              }
            : toNotificationCardState(
                initialNotifications.leads,
                leadsResult.rows,
                (row) => `${row.name?.trim() || "Без имени"} · ${row.phone}`,
                (row) => (row.type ? `Тип: ${row.type}` : "Запрос по запчастям"),
                (row) => `/admin/leads/${row.id}`,
              ),
          orders: ordersResult.error
            ? {
                ...initialNotifications.orders,
                status: "error",
                count: null,
                text: ordersResult.error,
              }
            : toNotificationCardState(
                initialNotifications.orders,
                ordersResult.rows,
                (row) =>
                  `${row.customer_name?.trim() || "Без имени"} · ${row.customer_phone}`,
                (row) =>
                  row.source === "checkout"
                    ? "Оформление корзины"
                    : row.source === "one_click"
                      ? "Быстрый заказ"
                      : `Источник: ${row.source || "не указан"}`,
                (row) => `/admin/orders/${row.id}`,
              ),
          vin: vinResult.error
            ? {
                ...initialNotifications.vin,
                status: "error",
                count: null,
                text: vinResult.error,
              }
            : toNotificationCardState(
                initialNotifications.vin,
                vinResult.rows,
                (row) => row.vin?.trim() || "VIN не указан",
                (row) => `${row.name?.trim() || "Без имени"} · ${row.phone}`,
                (row) => `/admin/vin-requests/${row.id}`,
              ),
          service: serviceResult.error
            ? {
                ...initialNotifications.service,
                status: "error",
                count: null,
                text: serviceResult.error,
              }
            : toNotificationCardState(
                initialNotifications.service,
                serviceResult.rows,
                (row) => row.service_type?.trim() || "Услуга не указана",
                (row) =>
                  `${row.vehicle_type === "truck" ? "Грузовой" : "Легковой"} · ${row.phone}`,
                (row) => `/admin/service-requests/${row.id}`,
              ),
        });
        setLastUpdated(new Date().toLocaleTimeString("ru-RU"));
      } catch (loadError) {
        if (redirectIfAdminUnauthorized(loadError, router)) {
          return;
        }
        if (!cancelled) {
          setStats({
            leads: { status: "error", count: null, text: "API недоступно" },
            orders: { status: "error", count: null, text: "API недоступно" },
            vin: { status: "error", count: null, text: "API недоступно" },
            service: { status: "error", count: null, text: "API недоступно" },
            products: { status: "error", count: null, text: "API недоступно" },
            categories: {
              status: "error",
              count: null,
              text: "API недоступно",
            },
            content: { status: "error", count: null, text: "API недоступно" },
          });
          setNotifications({
            leads: {
              ...initialNotifications.leads,
              status: "error",
              count: null,
              text: "API недоступно",
            },
            orders: {
              ...initialNotifications.orders,
              status: "error",
              count: null,
              text: "API недоступно",
            },
            vin: {
              ...initialNotifications.vin,
              status: "error",
              count: null,
              text: "API недоступно",
            },
            service: {
              ...initialNotifications.service,
              status: "error",
              count: null,
              text: "API недоступно",
            },
          });
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    };

    void loadStats();
    const refreshHandler = () => void loadStats(true);
    window.addEventListener("admin-dashboard-refresh", refreshHandler);

    return () => {
      cancelled = true;
      window.removeEventListener("admin-dashboard-refresh", refreshHandler);
    };
  }, [router]);

  const notificationCards = [
    notifications.leads,
    notifications.orders,
    notifications.vin,
    notifications.service,
  ];
  const totalNewNotifications = notificationCards.reduce(
    (sum, card) => sum + (card.count ?? 0),
    0,
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1F3B73]">Дашборд</h1>
      <p className="mt-2 text-neutral-600">
        Добро пожаловать в админ-панель. Здесь будет статистика и управление.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          disabled={isRefreshing}
          onClick={() =>
            window.dispatchEvent(new Event("admin-dashboard-refresh"))
          }
          className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          {isRefreshing ? "Обновление..." : "Обновить"}
        </button>
        {lastUpdated ? (
          <span className="text-neutral-500">Обновлено: {lastUpdated}</span>
        ) : null}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statConfigs.map((config) => {
          const card = stats[config.key];
          const value =
            card.status === "loading"
              ? "…"
              : card.count !== null
                ? String(card.count)
                : "—";
          return (
            <div
              key={config.key}
              className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
            >
              <div className="text-sm font-medium text-neutral-600">
                {config.label}
              </div>
              <div className="mt-2 text-2xl font-bold text-[#1F3B73]">
                {value}
              </div>
              <div className="mt-1 text-xs text-neutral-500">{card.text}</div>
            </div>
          );
        })}
      </div>

      <section
        id="notification-center"
        className="mt-8 rounded-2xl border border-[#1F3B73]/15 bg-white p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[#1F3B73]">
              Центр уведомлений
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Новые обращения клиентов. Нажмите на запись, чтобы открыть карточку
              и сразу взять в работу.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              totalNewNotifications > 0
                ? "border border-orange-300 bg-orange-50 text-orange-700"
                : "border border-neutral-200 bg-neutral-50 text-neutral-500"
            }`}
          >
            Всего новых: {totalNewNotifications}
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {notificationCards.map((card) => {
            const value =
              card.status === "loading"
                ? "…"
                : card.count !== null
                  ? String(card.count)
                  : "—";
            return (
              <div
                key={card.label}
                className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[#1F3B73]">
                    {card.label}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      card.count && card.count > 0
                        ? "bg-orange-100 text-orange-700"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {value}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{card.text}</p>

                {card.items.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {card.items.map((item) => (
                      <Link
                        key={`${card.label}-${item.id}`}
                        href={item.href}
                        className="block rounded-xl border border-neutral-200 bg-white px-3 py-2 transition hover:border-[#1F3B73]/40 hover:bg-[#1F3B73]/[0.04]"
                      >
                        <div className="text-sm font-medium text-neutral-800">
                          {item.title}
                        </div>
                        <div className="mt-0.5 text-xs text-neutral-500">
                          {item.subtitle}
                        </div>
                        <div className="mt-1 text-[11px] text-neutral-400">
                          {new Date(item.createdAt).toLocaleString("ru-RU")}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3">
                  <Link
                    href={card.href}
                    className="text-xs font-semibold text-[#1F3B73] hover:text-[#16325f]"
                  >
                    Открыть раздел →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Link
          href="/admin/content"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">
            Редактор сайта
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Редактирование текстов страниц, юридических документов и общих
            блоков
          </p>
        </Link>
        <Link
          href="/admin/imports"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">Импорты</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Загрузка CSV/XLSX, история запусков и просмотр ошибок импорта
          </p>
        </Link>
        <Link
          href="/admin/users"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">Пользователи</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Управление ролями и доступом сотрудников админки
          </p>
        </Link>
        <Link
          href="/admin/leads"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">
            Заявки на запчасти
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Просмотр и обработка заявок от клиентов (VIN, обратный звонок,
            подбор)
          </p>
        </Link>
        <Link
          href="/admin/vin-requests"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">VIN-заявки</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Отдельная очередь VIN-запросов с фильтрами и обработкой по статусу
          </p>
        </Link>
        <Link
          href="/admin/products"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">Товары</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Управление каталогом запчастей, добавление и редактирование
          </p>
        </Link>
        <Link
          href="/admin/categories"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">Категории</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Структура категорий для каталога запчастей
          </p>
        </Link>
        <Link
          href="/admin/service-requests"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">
            Заявки на сервис
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Записи на ремонт и обслуживание, управление статусами
          </p>
        </Link>
        <Link
          href="/admin/orders"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">Заказы</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Список заказов из корзины и быстрого заказа, контроль статусов
            обработки
          </p>
        </Link>
        <Link
          href="/admin/reports"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">Отчёты</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Операционная сводка по заявкам, товарам, категориям и статусам
          </p>
        </Link>
      </div>
    </div>
  );
}
