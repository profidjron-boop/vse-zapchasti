'use client';

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from 'js-cookie';
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";

export default function NewProductPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const data = {
      category_id: parseInt(formData.get("category_id") as string),
      sku: formData.get("sku"),
      oem: formData.get("oem") || undefined,
      brand: formData.get("brand") || undefined,
      name: formData.get("name"),
      description: formData.get("description") || undefined,
      price: formData.get("price") ? parseFloat(formData.get("price") as string) : null,
      stock_quantity: parseInt(formData.get("stock_quantity") as string) || 0,
      is_active: formData.get("is_active") === "on",
      attributes: {},
      images: [],
      compatibilities: []
    };

    try {
      const token = Cookies.get('admin_token');
      const apiBaseUrl = getClientApiBaseUrl();
      
      const response = await fetch(withApiBase(apiBaseUrl, "/api/admin/products"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Ошибка при создании товара");
      }

      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать товар");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/products"
          className="text-[#1F3B73] hover:underline"
        >
          ← Назад к товарам
        </Link>
        <h1 className="text-2xl font-bold text-[#1F3B73]">Новый товар</h1>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600 border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Название товара *
          </label>
          <input
            type="text"
            name="name"
            required
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Артикул (SKU) *
            </label>
            <input
              type="text"
              name="sku"
              required
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              OEM (опционально)
            </label>
            <input
              type="text"
              name="oem"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Категория *
            </label>
            <select
              name="category_id"
              required
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            >
              <option value="">Выберите категорию</option>
              <option value="1">Категория 1</option>
              <option value="2">Категория 2</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Бренд
            </label>
            <input
              type="text"
              name="brand"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Цена
            </label>
            <input
              type="number"
              name="price"
              step="0.01"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Количество на складе
            </label>
            <input
              type="number"
              name="stock_quantity"
              defaultValue="0"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Описание
          </label>
          <textarea
            name="description"
            rows={5}
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="is_active"
            id="is_active"
            defaultChecked={true}
            className="rounded border-neutral-300 text-[#1F3B73] focus:ring-[#1F3B73]"
          />
          <label htmlFor="is_active" className="text-sm text-neutral-700">
            Активен (показывать на сайте)
          </label>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl bg-[#FF7A00] px-6 py-3 font-medium text-white hover:bg-[#e66e00] disabled:opacity-50 transition"
          >
            {isSubmitting ? "Сохранение..." : "Создать товар"}
          </button>
        </div>
      </form>
    </div>
  );
}
