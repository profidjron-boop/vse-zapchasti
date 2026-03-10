"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { usePublicSiteContent } from "@/components/use-public-site-content";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

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

  if (normalized.length === 11 && normalized.startsWith("8"))
    normalized = `7${normalized.slice(1)}`;
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

function formatLineTotal(
  unitPrice: number | null,
  quantity: number,
  lineTotal: number | null,
): string {
  if (lineTotal !== null)
    return `${Math.round(lineTotal).toLocaleString("ru-RU")} ₽`;
  if (unitPrice !== null)
    return `${Math.round(unitPrice * quantity).toLocaleString("ru-RU")} ₽`;
  return "Цена по запросу";
}

export default function AccountOrdersPage() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { brandName, footerText, labels, contentValue } = usePublicSiteContent();
  const pageTitle = contentValue("orders_page_title", "Мои заказы");
  const pageSubtitle = contentValue(
    "orders_page_subtitle",
    "Введите телефон, который указывали при оформлении заказа, чтобы посмотреть историю и статусы.",
  );
  const showOrdersLabel = contentValue(
    "orders_show_button_label",
    "Показать заказы",
  );
  const emptyOrdersText = contentValue(
    "orders_empty_text",
    "По этому номеру пока нет заказов.",
  );

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
        withApiBase(
          apiBaseUrl,
          `/api/public/orders/history?phone=${encodeURIComponent(normalizedPhone)}`,
        ),
        { method: "GET" },
        12000,
      );
      setOrders(Array.isArray(payload) ? payload : []);
      setSearched(true);
    } catch (submitError) {
      setOrders([]);
      setSearched(true);
      if (submitError instanceof ApiRequestError) {
        setError(
          submitError.traceId
            ? `${submitError.message}. Код: ${submitError.traceId}`
            : submitError.message,
        );
      } else {
        setError("Не удалось получить историю заказов");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#F3F5F8] text-neutral-900">
      <PublicHeader
        brandName={brandName}
        activeKey="orders"
        labels={labels}
      />

      <section className="border-b border-neutral-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef3fb_100%)]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] lg:py-14">
          <div className="rounded-[2rem] bg-[linear-gradient(135deg,#1F3B73_0%,#17315E_65%,#10264B_100%)] p-8 text-white shadow-[0_30px_80px_rgba(31,59,115,0.18)]">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              orders · status tracking · history
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
              {pageTitle}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
              {pageSubtitle}
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/60">
                  поиск по номеру
                </div>
                <div className="mt-2 text-base font-semibold">
                  Без регистрации, по телефону из заказа
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/60">
                  что покажем
                </div>
                <div className="mt-2 text-base font-semibold">
                  Статусы, состав заказа, способ оплаты и доставки
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
              как работает поиск
            </div>
            <div className="mt-4 space-y-3">
              {[
                "Укажите тот же телефон, который использовали при оформлении заявки.",
                "Мы покажем все заказы, привязанные к этому номеру, с текущими статусами.",
                "Если по номеру ничего не найдено, можно связаться с менеджером через контакты или повторно оформить заявку.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-600"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
            поиск заказа
          </div>
          <form
            onSubmit={handleSubmit}
            className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
          >
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Телефон
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                inputMode="tel"
                placeholder="+7 (___) ___-__-__"
                className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm focus:border-[#1F3B73] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#1F3B73] px-5 text-sm font-semibold text-white transition hover:bg-[#17315E] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Загрузка..." : showOrdersLabel}
            </button>
          </form>

          <div className="mt-4 min-h-[4.5rem]">
            {error ? (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            ) : null}
          </div>
        </div>

        {!searched && !loading ? (
          <div className="mt-6 rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
            <div className="text-sm font-semibold text-[#1F3B73]">
              История заказов появится после поиска по номеру
            </div>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Укажите номер телефона из оформления заказа. Если заказа под рукой
              нет, можно перейти в каталог или связаться с менеджером.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/parts"
                className="inline-flex items-center justify-center rounded-2xl bg-[#1F3B73] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#17315E]"
              >
                В каталог
              </Link>
              <Link
                href="/contacts"
                className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Контакты
              </Link>
            </div>
          </div>
        ) : null}

        {searched && !loading && orders.length === 0 ? (
          <div className="mt-6 rounded-[2rem] border border-neutral-200 bg-white p-10 text-center shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
            <div className="mx-auto max-w-2xl">
              <h2 className="text-2xl font-bold text-[#10264B]">
                {emptyOrdersText}
              </h2>
              <p className="mt-3 text-sm leading-7 text-neutral-600">
                Проверьте номер телефона или обратитесь в магазин, если заказ
                оформлялся через менеджера на другой контакт.
              </p>
            </div>
          </div>
        ) : null}

        {orders.length > 0 ? (
          <div className="mt-6 space-y-4">
            {orders.map((order) => (
              <article
                key={order.id}
                className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF7A00]">
                      заказ #{order.id}
                    </div>
                    <h2 className="mt-2 text-2xl font-bold text-[#10264B]">
                      {getSourceLabel(order.source)}
                    </h2>
                    <p className="mt-2 text-sm text-neutral-500">
                      Создан:{" "}
                      {new Date(order.created_at).toLocaleString("ru-RU")}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500">
                      Обновлён:{" "}
                      {new Date(order.updated_at).toLocaleString("ru-RU")}
                    </p>
                  </div>
                  <span className="inline-flex rounded-full bg-[#1F3B73]/10 px-4 py-2 text-sm font-semibold text-[#1F3B73]">
                    {getStatusLabel(order.status)}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                      доставка
                    </div>
                    <div className="mt-2 font-semibold text-[#10264B]">
                      {getDeliveryLabel(order.delivery_method)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                      оплата
                    </div>
                    <div className="mt-2 font-semibold text-[#10264B]">
                      {getPaymentLabel(order.payment_method)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                      позиций
                    </div>
                    <div className="mt-2 font-semibold text-[#10264B]">
                      {order.items.length}
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {order.items.map((item, index) => (
                    <div
                      key={`${order.id}-${index}`}
                      className="rounded-[1.5rem] border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                            {item.product_sku
                              ? `sku · ${item.product_sku}`
                              : "товар"}
                          </div>
                          <div className="mt-2 text-base font-semibold text-[#10264B]">
                            {item.product_name}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-neutral-700">
                          {formatLineTotal(
                            item.unit_price,
                            item.quantity,
                            item.line_total,
                          )}
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-neutral-600">
                        Количество: {item.quantity}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <PublicFooter
        brandName={brandName}
        footerText={footerText}
        contactsLabel={labels.contacts}
      />
    </main>
  );
}
