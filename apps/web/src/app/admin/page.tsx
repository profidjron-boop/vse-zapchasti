'use client';

import Link from "next/link";
import { useState, useEffect } from 'react';
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type DashboardStatus = "loading" | "ready" | "empty" | "error";
type StatKey = "leads" | "orders" | "vin" | "service" | "products" | "categories" | "content";

type StatCardState = {
  status: DashboardStatus;
  count: number | null;
  text: string;
};

type StatConfig = {
  key: StatKey;
  label: string;
  endpoint: string;
};

const statConfigs: StatConfig[] = [
  { key: "leads", label: "Заявки (запчасти)", endpoint: "/api/admin/leads?limit=500" },
  { key: "orders", label: "Заказы", endpoint: "/api/admin/orders?limit=500" },
  { key: "vin", label: "VIN-заявки", endpoint: "/api/admin/vin-requests?limit=500" },
  { key: "service", label: "Заявки (сервис)", endpoint: "/api/admin/service-requests?limit=500" },
  { key: "products", label: "Товары", endpoint: "/api/admin/products?limit=500" },
  { key: "categories", label: "Категории", endpoint: "/api/admin/categories" },
  { key: "content", label: "Контент-блоки", endpoint: "/api/admin/content" },
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

function toCardState(payload: unknown): StatCardState {
  if (!Array.isArray(payload)) {
    return { status: "error", count: null, text: "Некорректный ответ API" };
  }
  const count = payload.length;
  if (count <= 0) {
    return { status: "empty", count: 0, text: "Пока пусто" };
  }
  return { status: "ready", count, text: "Данные доступны" };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Record<StatKey, StatCardState>>(initialStats);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async (showRefreshing = false) => {
      if (showRefreshing) {
        setIsRefreshing(true);
      }

      try {
        const token = localStorage.getItem('admin_token');
        if (!token) {
          window.location.href = '/admin/login';
          return;
        }

        const headers = {
          'Authorization': `Bearer ${token}`,
        };
        const apiBaseUrl = getClientApiBaseUrl();

        const entries = await Promise.all(
          statConfigs.map(async (config) => {
            try {
              const payload = await fetchJsonWithTimeout<unknown>(
                withApiBase(apiBaseUrl, config.endpoint),
                { headers },
                12000
              );
              return [config.key, toCardState(payload)] as const;
            } catch (fetchError) {
              if (fetchError instanceof ApiRequestError && (fetchError.status === 401 || fetchError.status === 403)) {
                throw fetchError;
              }
              if (fetchError instanceof ApiRequestError) {
                const errorText = fetchError.traceId ? `Ошибка. Код: ${fetchError.traceId}` : fetchError.message;
                return [config.key, { status: "error", count: null, text: errorText }] as const;
              }
              return [config.key, { status: "error", count: null, text: "API недоступно" }] as const;
            }
          })
        );

        if (cancelled) {
          return;
        }

        setStats(Object.fromEntries(entries) as Record<StatKey, StatCardState>);
        setLastUpdated(new Date().toLocaleTimeString("ru-RU"));
      } catch (loadError) {
        if (loadError instanceof ApiRequestError && (loadError.status === 401 || loadError.status === 403)) {
          localStorage.removeItem("admin_token");
          window.location.href = "/admin/login";
          return;
        }
        if (!cancelled) {
          setStats({
            leads: { status: "error", count: null, text: "API недоступно" },
            orders: { status: "error", count: null, text: "API недоступно" },
            vin: { status: "error", count: null, text: "API недоступно" },
            service: { status: "error", count: null, text: "API недоступно" },
            products: { status: "error", count: null, text: "API недоступно" },
            categories: { status: "error", count: null, text: "API недоступно" },
            content: { status: "error", count: null, text: "API недоступно" },
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
  }, []);


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
          onClick={() => window.dispatchEvent(new Event("admin-dashboard-refresh"))}
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
            card.status === "loading" ? "…" : card.count !== null ? String(card.count) : "—";
          return (
            <div key={config.key} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm font-medium text-neutral-600">{config.label}</div>
              <div className="mt-2 text-2xl font-bold text-[#1F3B73]">{value}</div>
              <div className="mt-1 text-xs text-neutral-500">{card.text}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Link
          href="/admin/reports"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">Отчёты</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Операционная сводка по заявкам, товарам, категориям и статусам
          </p>
        </Link>
        <Link
          href="/admin/content"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">Редактор сайта</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Редактирование текстов страниц, юридических документов и общих блоков
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
          <h2 className="text-lg font-semibold text-[#1F3B73]">Заявки на запчасти</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Просмотр и обработка заявок от клиентов (VIN, обратный звонок, подбор)
          </p>
        </Link>
        <Link
          href="/admin/orders"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">Заказы</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Список заказов из корзины и быстрого заказа, контроль статусов обработки
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
          <h2 className="text-lg font-semibold text-[#1F3B73]">Заявки на сервис</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Записи на ремонт и обслуживание, управление статусами
          </p>
        </Link>
      </div>
    </div>
  );
}
