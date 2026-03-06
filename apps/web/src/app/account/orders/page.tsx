"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type OrderHistoryItem = {
  id: number;
  uuid: string;
  status: string;
  source: string;
  delivery_method: string | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  items: Array<{
    product_sku: string | null;
    product_name: string;
    quantity: number;
    unit_price: number | null;
    line_total: number | null;
  }>;
};

function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  let normalized = digits;

  if (normalized.length === 11 && normalized.startsWith("8")) normalized = `7${normalized.slice(1)}`;
  if (normalized.length === 10) normalized = `7${normalized}`;

  if (normalized.length !== 11 || !normalized.startsWith("7")) return null;
  return `+${normalized}`;
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    new: "Новый",
    in_progress: "В работе",
    ready: "Готов",
    closed: "Закрыт",
    canceled: "Отменён",
  };
  return map[status] ?? status;
}

function getDeliveryLabel(value: string | null): string {
  if (value === "courier") return "Курьер";
  if (value === "pickup") return "Самовывоз";
  return "—";
}

function getPaymentLabel(value: string | null): string {
  if (value === "invoice") return "По счёту";
  if (value === "cash_on_delivery") return "При получении";
  return "—";
}

function getSourceLabel(value: string): string {
  if (value === "one_click") return "Быстрый заказ";
  if (value === "checkout") return "Оформление корзины";
  return value;
}

export default function AccountOrdersPage() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      setError("Укажите корректный телефон в формате РФ (+7XXXXXXXXXX).");
      setOrders([]);
      setSearched(true);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const payload = await fetchJsonWithTimeout<OrderHistoryItem[]>(
        withApiBase(apiBaseUrl, `/api/public/orders/history?phone=${encodeURIComponent(normalizedPhone)}`),
        { method: "GET" },
        12000
      );
      setOrders(Array.isArray(payload) ? payload : []);
      setSearched(true);
    } catch (submitError) {
      setOrders([]);
      setSearched(true);
      if (submitError instanceof ApiRequestError) {
        setError(submitError.traceId ? `${submitError.message}. Код: ${submitError.traceId}` : submitError.message);
      } else {
        setError("Не удалось получить историю заказов");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-[#1F3B73]">Все запчасти</Link>
            <nav className="hidden items-center gap-8 md:flex">
              <Link href="/parts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Запчасти</Link>
              <Link href="/favorites" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Избранное</Link>
              <Link href="/cart" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Корзина</Link>
              <Link href="/account/orders" className="text-sm font-medium text-[#1F3B73] border-b-2 border-[#1F3B73] pb-1">Мои заказы</Link>
            </nav>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-bold text-[#1F3B73]">Мои заказы</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Введите телефон, который указывали при оформлении заказа, чтобы посмотреть историю и статусы.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">Телефон</label>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                inputMode="tel"
                placeholder="+7 (___) ___-__-__"
                className="h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm focus:border-[#1F3B73] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-11 rounded-xl bg-[#1F3B73] px-4 text-sm font-medium text-white hover:bg-[#14294F] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Загрузка..." : "Показать заказы"}
            </button>
          </div>
        </form>

        {error ? (
          <div role="alert" aria-live="assertive" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        {searched && !loading && orders.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
            По этому номеру пока нет заказов.
          </div>
        ) : null}

        {orders.length > 0 ? (
          <div className="mt-6 space-y-3">
            {orders.map((order) => (
              <article key={order.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-neutral-500">Заказ #{order.id}</p>
                    <p className="text-xs text-neutral-500">
                      Создан: {new Date(order.created_at).toLocaleString("ru-RU")}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#1F3B73]/10 px-3 py-1 text-xs font-medium text-[#1F3B73]">
                    {getStatusLabel(order.status)}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
                  <p>Источник: {getSourceLabel(order.source)}</p>
                  <p>Доставка: {getDeliveryLabel(order.delivery_method)}</p>
                  <p>Оплата: {getPaymentLabel(order.payment_method)}</p>
                </div>

                <div className="mt-3 space-y-1 text-sm text-neutral-700">
                  {order.items.map((item, index) => (
                    <p key={`${order.id}-${index}`}>
                      {item.product_name} x{item.quantity}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
