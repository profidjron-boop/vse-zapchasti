'use client';

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import {
  CartItem,
  clearCart,
  getCartTotals,
  loadCart,
  removeFromCart,
  updateCartItemQuantity,
} from "@/lib/cart";

function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  let normalized = digits;

  if (normalized.length === 11 && normalized.startsWith("8")) normalized = `7${normalized.slice(1)}`;
  if (normalized.length === 10) normalized = `7${normalized}`;

  if (normalized.length !== 11 || !normalized.startsWith("7")) return null;
  return `+${normalized}`;
}

function getLineAmount(item: CartItem): string {
  if (item.price === null) return "Цена по запросу";
  return `${Math.round(item.price * item.quantity).toLocaleString("ru-RU")} ₽`;
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash_on_delivery" | "invoice">("cash_on_delivery");
  const [selectedInvoiceFileName, setSelectedInvoiceFileName] = useState("");
  const [contentMap, setContentMap] = useState<Record<string, string>>({});

  useEffect(() => {
    setItems(loadCart());
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      try {
        const apiBaseUrl = getClientApiBaseUrl();
        const response = await fetch(withApiBase(apiBaseUrl, "/api/public/content"), { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as Array<{ key?: string; value?: string | null }>;
        if (!Array.isArray(payload) || cancelled) return;

        const map: Record<string, string> = {};
        for (const item of payload) {
          if (item?.key && typeof item.value === "string") {
            map[item.key] = item.value;
          }
        }
        setContentMap(map);
      } catch {
        // keep defaults
      }
    }

    void loadContent();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => getCartTotals(items), [items]);
  const isEmptyState = !loading && items.length === 0;

  const contentValue = (key: string, fallback: string): string => {
    const value = contentMap[key];
    return value && value.trim() ? value : fallback;
  };

  const brandName = contentValue("site_brand_name", "Все запчасти");
  const navParts = contentValue("site_nav_parts_label", "Запчасти");
  const navService = contentValue("site_nav_service_label", "Автосервис");
  const navContacts = contentValue("site_nav_contacts_label", "Контакты");
  const navAbout = contentValue("site_nav_about_label", "О компании");
  const navFavorites = contentValue("site_nav_favorites_label", "Избранное");
  const navCart = contentValue("site_nav_cart_label", "Корзина");
  const navOrders = contentValue("site_nav_orders_label", "Мои заказы");
  const navDealer = contentValue("site_nav_dealer_label", "Для дилеров");
  const navCallback = contentValue("site_nav_callback_label", "Заказать звонок");
  const pageTitle = contentValue("cart_page_title", "Корзина");
  const emptyCartText = contentValue("cart_empty_text", "Ваша корзина пуста");
  const goToCatalogLabel = contentValue("cart_go_to_catalog_label", "Перейти в каталог");
  const checkoutTitle = contentValue("cart_checkout_title", "Оформление заказа");
  const itemsTitle = contentValue("cart_items_title", "Товары");
  const footerText = contentValue("site_footer_text", "Все запчасти · Красноярск · NO CDN");

  function handleChangeQuantity(productId: number, nextQuantity: number) {
    const safeQuantity = Number.isFinite(nextQuantity) && nextQuantity > 0 ? nextQuantity : 1;
    setItems(updateCartItemQuantity(productId, safeQuantity));
  }

  function handleRemoveItem(productId: number) {
    setItems(removeFromCart(productId));
  }

  async function handleSubmitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setSuccess("");
    setOrderId(null);

    if (items.length === 0) {
      setError("Корзина пуста. Добавьте товары перед оформлением заказа.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const consentGiven = formData.get("consent") === "on";
    const phoneRaw = formData.get("customer_phone")?.toString().trim() || "";
    const customerPhone = normalizePhone(phoneRaw);
    const selectedPaymentMethod = (formData.get("payment_method")?.toString() || "") as
      | "cash_on_delivery"
      | "invoice";
    const legalEntityInn = formData.get("legal_entity_inn")?.toString().trim() || "";
    const invoiceRequisitesFile = formData.get("invoice_requisites_file");

    if (!customerPhone) {
      setError("Проверьте телефон. Нужен формат РФ: +7XXXXXXXXXX.");
      return;
    }

    if (selectedPaymentMethod === "invoice" && !legalEntityInn) {
      setError("Для оплаты по счёту укажите ИНН организации.");
      return;
    }

    setSubmitting(true);
    try {
      let invoiceRequisitesFileUrl: string | undefined;
      let invoiceRequisitesFileName: string | undefined;
      const invoiceFile =
        invoiceRequisitesFile instanceof File && invoiceRequisitesFile.size > 0 ? invoiceRequisitesFile : null;

      if (selectedPaymentMethod === "invoice" && invoiceFile) {
        const extension = invoiceFile.name.split(".").pop()?.toLowerCase() || "";
        if (!["pdf", "png", "jpg", "jpeg"].includes(extension)) {
          setError("Для реквизитов допустимы только PDF, PNG или JPG.");
          setSubmitting(false);
          return;
        }
        if (invoiceFile.size > 10 * 1024 * 1024) {
          setError("Размер файла реквизитов не должен превышать 10 МБ.");
          setSubmitting(false);
          return;
        }

        const uploadFormData = new FormData();
        uploadFormData.set("file", invoiceFile);

        const apiBaseUrl = getClientApiBaseUrl();
        const uploadResult = await fetchJsonWithTimeout<{
          url: string;
          filename: string;
          size_bytes: number;
          content_type: string;
        }>(
          withApiBase(apiBaseUrl, "/api/public/orders/requisites-upload"),
          {
            method: "POST",
            body: uploadFormData,
          },
          12000
        );
        invoiceRequisitesFileUrl = uploadResult.url;
        invoiceRequisitesFileName = uploadResult.filename;
      }

      const payload = {
        source: "checkout",
        customer_name: formData.get("customer_name")?.toString().trim() || undefined,
        customer_phone: customerPhone,
        customer_email: formData.get("customer_email")?.toString().trim() || undefined,
        comment: formData.get("comment")?.toString().trim() || undefined,
        delivery_method: formData.get("delivery_method")?.toString() || undefined,
        payment_method: formData.get("payment_method")?.toString() || undefined,
        legal_entity_name: formData.get("legal_entity_name")?.toString().trim() || undefined,
        legal_entity_inn: legalEntityInn || undefined,
        invoice_requisites_file_url: invoiceRequisitesFileUrl,
        invoice_requisites_file_name: invoiceRequisitesFileName,
        consent_given: consentGiven,
        consent_version: "v1.0",
        items: items.map((item) => ({
          product_id: item.productId,
          product_sku: item.sku,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price ?? undefined,
          line_total: item.price !== null ? item.price * item.quantity : undefined,
        })),
      };

      const apiBaseUrl = getClientApiBaseUrl();
      const result = await fetchJsonWithTimeout<{ id?: number }>(
        withApiBase(apiBaseUrl, "/api/public/orders"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        12000
      );
      setOrderId(result.id ?? null);
      setSuccess("Заказ оформлен. Менеджер свяжется с вами для подтверждения.");
      clearCart();
      setItems([]);
      setPaymentMethod("cash_on_delivery");
      setSelectedInvoiceFileName("");
      event.currentTarget.reset();
    } catch (submitError) {
      if (submitError instanceof ApiRequestError) {
        setError(submitError.traceId ? `${submitError.message}. Код: ${submitError.traceId}` : submitError.message);
      } else {
        setError("Не удалось оформить заказ. Попробуйте позже.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[#F3F5F8] text-neutral-900">
      <PublicHeader
        brandName={brandName}
        activeKey="cart"
        labels={{
          parts: navParts,
          service: navService,
          contacts: navContacts,
          about: navAbout,
          favorites: navFavorites,
          cart: navCart,
          orders: navOrders,
          dealer: navDealer,
          callback: navCallback,
        }}
      />

      <section className="border-b border-neutral-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef3fb_100%)]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] lg:py-14">
          <div className="rounded-[2rem] bg-[linear-gradient(135deg,#1F3B73_0%,#17315E_65%,#10264B_100%)] p-8 text-white shadow-[0_30px_80px_rgba(31,59,115,0.18)]">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              checkout · guest order · retail
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">{pageTitle}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
              {isEmptyState
                ? "Добавьте товары в корзину, чтобы оформить заказ без регистрации и отправить заявку менеджеру."
                : "Проверьте состав заказа, укажите способ получения и отправьте заявку менеджеру на подтверждение."}
            </p>
            {isEmptyState ? (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/60">первый шаг</div>
                  <div className="mt-2 text-base font-semibold">Откройте каталог и добавьте нужные позиции</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/60">второй шаг</div>
                  <div className="mt-2 text-base font-semibold">Оформите заказ или отправьте заявку на подбор</div>
                </div>
              </div>
            ) : (
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/60">позиций</div>
                  <div className="mt-2 text-2xl font-bold">{totals.count}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/60">товаров</div>
                  <div className="mt-2 text-2xl font-bold">{items.length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/60">сумма</div>
                  <div className="mt-2 text-2xl font-bold">
                    {totals.amount !== null ? `${Math.round(totals.amount).toLocaleString("ru-RU")} ₽` : "по запросу"}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
              {isEmptyState ? "как начать" : "что дальше"}
            </div>
            <div className="mt-4 space-y-3">
              {(isEmptyState
                ? [
                    "Подберите товары по артикулу, OEM или названию в каталоге.",
                    "Если нужной позиции нет, отправьте VIN-заявку или запрос на подбор.",
                    "После добавления товаров сможете оформить заказ без регистрации.",
                  ]
                : [
                    "Проверяем наличие и окончательную стоимость по каждой позиции.",
                    "Подтверждаем самовывоз, курьерскую доставку или работу по счёту.",
                    "Менеджер связывается для финального согласования заказа.",
                  ]).map((item) => (
                <div key={item} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-600">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Link
                href="/parts"
                className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:border-[#1F3B73] hover:text-[#1F3B73]"
              >
                {goToCatalogLabel}
              </Link>
              <Link
                href="/account/orders"
                className="inline-flex items-center justify-center rounded-2xl bg-[#FF7A00] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#e66e00]"
              >
                {isEmptyState ? "Открыть мои заказы" : "Проверить историю заказов"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {loading ? (
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-8 text-sm text-neutral-500 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
            Загрузка корзины...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-10 text-center shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
            <div className="mx-auto max-w-2xl">
              <h2 className="text-2xl font-bold text-[#10264B]">{emptyCartText}</h2>
              <p className="mt-3 text-sm leading-7 text-neutral-600">
                Начните с каталога или VIN-подбора. Когда добавите товары, здесь появится полный checkout с доставкой,
                оплатой и заявкой менеджеру.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/parts"
                  className="inline-flex items-center justify-center rounded-2xl bg-[#1F3B73] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#17315E]"
                >
                  {goToCatalogLabel}
                </Link>
                <Link
                  href="/parts/vin"
                  className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  Оставить VIN-заявку
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.85fr)]">
            <div className="space-y-6">
              <section className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">состав заказа</div>
                    <h2 className="mt-2 text-2xl font-bold text-[#10264B]">{itemsTitle}</h2>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-600">
                    {items.length} поз. · {totals.count} шт.
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {items.map((item) => (
                    <article
                      key={item.productId}
                      className="rounded-[1.75rem] border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF7A00]">sku · {item.sku}</div>
                          <h3 className="mt-2 text-lg font-semibold text-[#10264B]">{item.name}</h3>
                          <div className="mt-3 flex flex-wrap gap-2 text-sm text-neutral-600">
                            <span className="rounded-full bg-neutral-100 px-3 py-1">{item.price !== null ? `${Math.round(item.price).toLocaleString("ru-RU")} ₽/шт.` : "Цена по запросу"}</span>
                            <span className="rounded-full bg-neutral-100 px-3 py-1">Итого: {getLineAmount(item)}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.productId)}
                          className="inline-flex items-center justify-center rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Удалить
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Количество</label>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={item.quantity}
                          onChange={(event) => handleChangeQuantity(item.productId, Number(event.target.value))}
                          className="h-11 w-28 rounded-2xl border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-900 focus:border-[#1F3B73] focus:outline-none"
                        />
                        <Link
                          href={`/parts/p/${encodeURIComponent(item.sku)}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-[#1F3B73] hover:text-[#1F3B73]"
                        >
                          Открыть карточку
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
              <section className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] sm:p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">summary</div>
                <h2 className="mt-2 text-2xl font-bold text-[#10264B]">{checkoutTitle}</h2>
                <div className="mt-5 rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                  <div className="flex items-center justify-between gap-3">
                    <span>Позиции</span>
                    <span className="font-semibold text-[#10264B]">{items.length}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span>Количество</span>
                    <span className="font-semibold text-[#10264B]">{totals.count}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-neutral-200 pt-3">
                    <span>Сумма</span>
                    <span className="text-base font-bold text-[#10264B]">
                      {totals.amount !== null ? `${Math.round(totals.amount).toLocaleString("ru-RU")} ₽` : "по запросу"}
                    </span>
                  </div>
                </div>

                {error ? (
                  <div role="alert" aria-live="assertive" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                {success ? (
                  <div role="status" aria-live="polite" className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {success}
                    {orderId ? <span className="mt-1 block text-xs">Номер заказа: #{orderId}</span> : null}
                    <Link href="/account/orders" className="mt-2 inline-block text-xs font-semibold text-green-800 hover:underline">
                      Перейти в мои заказы
                    </Link>
                  </div>
                ) : null}

                <form onSubmit={handleSubmitOrder} className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Имя</label>
                    <input
                      type="text"
                      name="customer_name"
                      autoComplete="name"
                      className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm focus:border-[#1F3B73] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Телефон *</label>
                    <input
                      type="tel"
                      name="customer_phone"
                      required
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="+7 (___) ___-__-__"
                      className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm focus:border-[#1F3B73] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Email</label>
                    <input
                      type="email"
                      name="customer_email"
                      autoComplete="email"
                      className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm focus:border-[#1F3B73] focus:outline-none"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Доставка</label>
                      <select
                        name="delivery_method"
                        className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm focus:border-[#1F3B73] focus:outline-none"
                      >
                        <option value="pickup">Самовывоз</option>
                        <option value="courier">Курьер</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Оплата</label>
                      <select
                        name="payment_method"
                        value={paymentMethod}
                        onChange={(event) =>
                          setPaymentMethod(event.target.value === "invoice" ? "invoice" : "cash_on_delivery")
                        }
                        className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm focus:border-[#1F3B73] focus:outline-none"
                      >
                        <option value="cash_on_delivery">При получении</option>
                        <option value="invoice">По счёту</option>
                      </select>
                    </div>
                  </div>

                  {paymentMethod === "invoice" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Организация</label>
                        <input
                          type="text"
                          name="legal_entity_name"
                          placeholder='ООО "Пример"'
                          className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm focus:border-[#1F3B73] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">ИНН *</label>
                        <input
                          type="text"
                          name="legal_entity_inn"
                          required
                          placeholder="10 или 12 цифр"
                          className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm focus:border-[#1F3B73] focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                          Реквизиты файлом
                        </label>
                        <input
                          type="file"
                          name="invoice_requisites_file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(event) => setSelectedInvoiceFileName(event.target.files?.[0]?.name || "")}
                          className="block w-full rounded-[1.5rem] border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm file:mr-4 file:rounded-2xl file:border-0 file:bg-[#1F3B73] file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-[#17315E]"
                        />
                        <p className="mt-2 text-xs leading-5 text-neutral-500">
                          Необязательно. Можно приложить карточку организации или PDF с реквизитами. Допустимы PDF, PNG и JPG до 10 МБ.
                        </p>
                        {selectedInvoiceFileName ? (
                          <p className="mt-2 text-xs font-medium text-[#10264B]">Выбран файл: {selectedInvoiceFileName}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Комментарий</label>
                    <textarea
                      name="comment"
                      rows={4}
                      className="w-full rounded-[1.5rem] border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm focus:border-[#1F3B73] focus:outline-none"
                    />
                  </div>

                  <label className="flex items-start gap-3 rounded-[1.5rem] border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-600">
                    <input type="checkbox" name="consent" className="mt-1 size-4" required />
                    <span>Согласен на обработку персональных данных в соответствии с 152-ФЗ и политикой конфиденциальности.</span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-[#FF7A00] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#e66e00] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Оформление..." : "Оформить заказ"}
                  </button>
                </form>
              </section>
            </aside>
          </div>
        )}
      </section>

      <PublicFooter brandName={brandName} footerText={footerText} contactsLabel={navContacts} />
    </main>
  );
}
