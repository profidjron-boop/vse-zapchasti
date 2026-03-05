'use client';

import Link from "next/link";
import { FormEvent, useState } from "react";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { addToCart, getCartTotals } from "@/lib/cart";

type ProductLeadFormProps = {
  productId: number;
  productSku: string;
  productName: string;
  productPrice?: number | null;
};

export default function ProductLeadForm({
  productId,
  productSku,
  productName,
  productPrice = null,
}: ProductLeadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [leadId, setLeadId] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [phoneHint, setPhoneHint] = useState("");
  const [cartNotice, setCartNotice] = useState("");

  function normalizePhone(value: string): string | null {
    const digits = value.replace(/\D/g, "");
    let normalized = digits;
    if (normalized.length === 11 && normalized.startsWith("8")) normalized = `7${normalized.slice(1)}`;
    if (normalized.length === 10) normalized = `7${normalized}`;
    if (normalized.length !== 11 || !normalized.startsWith("7")) return null;
    return `+${normalized}`;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setSuccess("");
    setLeadId(null);
    setOrderId(null);
    setPhoneHint("");
    setIsSubmitting(true);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const submitMode = submitter?.value || "lead";

    const form = event.currentTarget;
    const formData = new FormData(form);
    const consentGiven = formData.get("consent") === "on";
    const phoneRaw = formData.get("phone")?.toString().trim() || "";
    const normalizedPhone = normalizePhone(phoneRaw);

    if (!normalizedPhone) {
      setError("Проверьте телефон. Нужен формат РФ: +7XXXXXXXXXX.");
      setPhoneHint("Пример: +7 999 123-45-67");
      setIsSubmitting(false);
      return;
    }

    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const commonMessage =
        formData.get("message")?.toString().trim()
        || `Запрос по товару: ${productName} (${productSku}, id:${productId})`;

      const endpoint = submitMode === "quick_order" ? "/api/public/orders" : "/api/public/leads";
      const payload =
        submitMode === "quick_order"
          ? {
              source: "one_click",
              customer_name: formData.get("name")?.toString().trim() || undefined,
              customer_phone: normalizedPhone,
              comment: commonMessage,
              consent_given: consentGiven,
              consent_version: "v1.0",
              items: [
                {
                  product_id: productId,
                  product_sku: productSku,
                  product_name: productName,
                  quantity: 1,
                },
              ],
            }
          : {
              type: "product",
              name: formData.get("name")?.toString().trim() || undefined,
              phone: normalizedPhone,
              product_sku: productSku,
              message: commonMessage,
              consent_given: consentGiven,
              consent_version: "v1.0",
            };

      const response = await fetch(withApiBase(apiBaseUrl, endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail || "Не удалось отправить заявку");
      }

      const result = (await response.json()) as { id?: number };
      form.reset();
      if (submitMode === "quick_order") {
        setOrderId(result.id ?? null);
        setSuccess("Быстрый заказ отправлен. Менеджер свяжется с вами в рабочее время.");
      } else {
        setLeadId(result.id ?? null);
        setSuccess("Заявка отправлена. Менеджер свяжется с вами в рабочее время.");
      }
    } catch (submitError) {
      console.error(submitError);
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Не удалось отправить заявку. Попробуйте позже.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAddToCart() {
    const items = addToCart(
      {
        productId,
        sku: productSku,
        name: productName,
        price: productPrice,
      },
      1
    );
    const totals = getCartTotals(items);
    const amountLabel = totals.amount !== null ? `, сумма ~ ${Math.round(totals.amount).toLocaleString("ru-RU")} ₽` : "";
    setCartNotice(`Товар добавлен в корзину. Позиций: ${totals.count}${amountLabel}.`);
  }

  return (
    <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <h2 className="text-sm font-semibold text-[#1F3B73]">Уточнить/Заказать</h2>
      <p className="mt-1 text-xs text-neutral-600">
        Оставьте телефон, и менеджер уточнит наличие и условия заказа.
      </p>

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
          {leadId ? (
            <span className="mt-1 block text-xs text-green-800">
              Для оператора: заявка #{leadId} в админке{" "}
              <Link href={`/admin/leads/${leadId}`} className="underline">
                открыть
              </Link>
            </span>
          ) : null}
          {orderId ? (
            <>
              <span className="mt-1 block text-xs text-green-800">
                Для оператора: заказ #{orderId} в админке{" "}
                <Link href="/admin/orders" className="underline">
                  открыть список заказов
                </Link>
              </span>
              <span className="mt-1 block text-xs text-green-800">
                Для клиента:{" "}
                <Link href="/account/orders" className="underline">
                  проверить статус в “Мои заказы”
                </Link>
              </span>
            </>
          ) : null}
        </div>
      )}
      {cartNotice && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {cartNotice}{" "}
          <Link href="/cart" className="underline">
            Перейти в корзину
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">Имя (опционально)</label>
          <input
            type="text"
            name="name"
            placeholder="Как к вам обращаться"
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">Телефон *</label>
          <input
            type="tel"
            name="phone"
            required
            placeholder="+7 (___) ___-__-__"
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          />
          <p className="mt-1 text-xs text-neutral-500">{phoneHint || "Формат РФ: +7XXXXXXXXXX"}</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">Комментарий (опционально)</label>
          <textarea
            name="message"
            rows={3}
            placeholder="Например: нужен оригинал, срок поставки, количество"
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          />
        </div>

        <input
          type="hidden"
          name="product_info"
          value={`${productName} (${productSku})`}
          readOnly
        />

        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
          <p className="text-xs text-neutral-500">Товар</p>
          <p className="text-sm text-neutral-700">{productName} · {productSku}</p>
        </div>
        <button
          type="button"
          onClick={handleAddToCart}
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          В корзину
        </button>

        <label className="flex items-start gap-2 text-xs text-neutral-600">
          <input type="checkbox" name="consent" className="mt-0.5" required />
          <span>Согласен на обработку персональных данных (152-ФЗ) и условия политики конфиденциальности</span>
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="submit"
            value="lead"
            disabled={isSubmitting}
            className="w-full rounded-xl border border-[#1F3B73]/20 bg-white px-4 py-2 text-sm font-medium text-[#1F3B73] hover:bg-[#1F3B73]/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Отправка..." : "Уточнить наличие"}
          </button>
          <button
            type="submit"
            value="quick_order"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[#FF7A00] px-4 py-2 text-sm font-medium text-white hover:bg-[#e66e00] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Отправка..." : "Быстрый заказ (1 клик)"}
          </button>
        </div>
      </form>
    </div>
  );
}
