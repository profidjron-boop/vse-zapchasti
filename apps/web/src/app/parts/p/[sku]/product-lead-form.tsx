'use client';

import { FormEvent, useState } from "react";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";

type ProductLeadFormProps = {
  productId: number;
  productSku: string;
  productName: string;
};

export default function ProductLeadForm({
  productId,
  productSku,
  productName,
}: ProductLeadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const consentGiven = formData.get("consent") === "on";

    const payload = {
      type: "product",
      phone: formData.get("phone")?.toString().trim() || "",
      product_id: productId,
      product_sku: productSku,
      message: `Запрос по товару: ${productName} (${productSku})`,
      consent_given: consentGiven,
      consent_version: "v1.0",
      consent_text: "Согласие на обработку персональных данных в соответствии с политикой конфиденциальности",
    };

    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const response = await fetch(withApiBase(apiBaseUrl, "/api/public/leads"), {
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

      form.reset();
      setSuccess("Заявка отправлена. Менеджер свяжется с вами в рабочее время.");
    } catch (submitError) {
      console.error(submitError);
      setError("Не удалось отправить заявку. Попробуйте позже.");
    } finally {
      setIsSubmitting(false);
    }
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
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <input
          type="tel"
          name="phone"
          required
          placeholder="+7 (___) ___-__-__"
          className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
        />

        <label className="flex items-start gap-2 text-xs text-neutral-600">
          <input type="checkbox" name="consent" className="mt-0.5" required />
          <span>Согласен на обработку персональных данных (152-ФЗ)</span>
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-[#FF7A00] px-4 py-2 text-sm font-medium text-white hover:bg-[#e66e00] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Отправка..." : "Отправить заявку"}
        </button>
      </form>
    </div>
  );
}
