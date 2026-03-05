'use client';

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
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

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState<number | null>(null);

  useEffect(() => {
    setItems(loadCart());
    setLoading(false);
  }, []);

  const totals = useMemo(() => getCartTotals(items), [items]);

  function handleChangeQuantity(productId: number, nextQuantity: number) {
    setItems(updateCartItemQuantity(productId, nextQuantity));
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

    if (!customerPhone) {
      setError("Проверьте телефон. Нужен формат РФ: +7XXXXXXXXXX.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        source: "checkout",
        customer_name: formData.get("customer_name")?.toString().trim() || undefined,
        customer_phone: customerPhone,
        customer_email: formData.get("customer_email")?.toString().trim() || undefined,
        comment: formData.get("comment")?.toString().trim() || undefined,
        delivery_method: formData.get("delivery_method")?.toString() || undefined,
        payment_method: formData.get("payment_method")?.toString() || undefined,
        legal_entity_name: formData.get("legal_entity_name")?.toString().trim() || undefined,
        legal_entity_inn: formData.get("legal_entity_inn")?.toString().trim() || undefined,
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
      const response = await fetch(withApiBase(apiBaseUrl, "/api/public/orders"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail || "Не удалось оформить заказ");
      }

      const result = (await response.json()) as { id?: number };
      setOrderId(result.id ?? null);
      setSuccess("Заказ оформлен. Менеджер свяжется с вами для подтверждения.");
      clearCart();
      setItems([]);
      event.currentTarget.reset();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось оформить заказ. Попробуйте позже.");
    } finally {
      setSubmitting(false);
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
              <Link href="/service" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Автосервис</Link>
              <Link href="/contacts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Контакты</Link>
              <Link href="/favorites" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Избранное</Link>
              <Link href="/cart" className="text-sm font-medium text-[#1F3B73] border-b-2 border-[#1F3B73] pb-1">Корзина</Link>
              <Link href="/account/orders" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Мои заказы</Link>
            </nav>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-bold text-[#1F3B73]">Корзина</h1>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Загрузка...</div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-8 text-center">
            <p className="text-neutral-600">Ваша корзина пуста</p>
            <Link
              href="/parts"
              className="mt-4 inline-block rounded-2xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#14294F]"
            >
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <h2 className="mb-4 text-lg font-semibold text-[#1F3B73]">Товары</h2>
              <div className="space-y-3">
                {items.map((item) => (
                  <article key={item.productId} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-neutral-900">{item.name}</p>
                        <p className="mt-1 text-xs text-neutral-500">{item.sku}</p>
                        <p className="mt-1 text-sm text-[#1F3B73]">
                          {item.price !== null ? `${Math.round(item.price).toLocaleString("ru-RU")} ₽` : "Цена по запросу"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.productId)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Удалить
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <label className="text-xs text-neutral-500">Количество</label>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={item.quantity}
                        onChange={(event) => handleChangeQuantity(item.productId, Number(event.target.value))}
                        className="w-24 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-sm"
                      />
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <h2 className="mb-4 text-lg font-semibold text-[#1F3B73]">Оформление заказа</h2>
              <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
                <p>Позиций: <span className="font-medium">{totals.count}</span></p>
                <p className="mt-1">
                  Сумма:{" "}
                  <span className="font-medium">
                    {totals.amount !== null ? `${Math.round(totals.amount).toLocaleString("ru-RU")} ₽` : "по запросу"}
                  </span>
                </p>
              </div>

              {error && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
              )}
              {success && (
                <div className="mb-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {success}
                  {orderId ? <span className="mt-1 block text-xs">Номер заказа: #{orderId}</span> : null}
                  <Link href="/account/orders" className="mt-1 block text-xs font-medium text-green-800 hover:underline">
                    Перейти в мои заказы
                  </Link>
                </div>
              )}

              <form onSubmit={handleSubmitOrder} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700">Имя (опционально)</label>
                  <input
                    type="text"
                    name="customer_name"
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700">Телефон *</label>
                  <input
                    type="tel"
                    name="customer_phone"
                    required
                    placeholder="+7 (___) ___-__-__"
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700">Email (опционально)</label>
                  <input
                    type="email"
                    name="customer_email"
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Доставка</label>
                    <select
                      name="delivery_method"
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
                    >
                      <option value="pickup">Самовывоз</option>
                      <option value="courier">Курьер</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700">Оплата</label>
                    <select
                      name="payment_method"
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
                    >
                      <option value="cash_on_delivery">При получении</option>
                      <option value="invoice">По счёту</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700">Комментарий</label>
                  <textarea
                    name="comment"
                    rows={3}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
                  />
                </div>

                <label className="flex items-start gap-2 text-xs text-neutral-600">
                  <input type="checkbox" name="consent" className="mt-0.5" required />
                  <span>Согласен на обработку персональных данных (152-ФЗ)</span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-[#FF7A00] px-4 py-2 text-sm font-medium text-white hover:bg-[#e66e00] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Оформление..." : "Оформить заказ"}
                </button>
              </form>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
