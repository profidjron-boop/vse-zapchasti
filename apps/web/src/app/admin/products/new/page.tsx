'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type Category = {
  id: number;
  name: string;
};

export default function NewProductPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    async function loadCategories() {
      try {
        const token = localStorage.getItem("admin_token");
        if (!token) {
          router.push("/admin/login");
          return;
        }

        const apiBaseUrl = getClientApiBaseUrl();
        const payload = await fetchJsonWithTimeout<Category[]>(
          withApiBase(apiBaseUrl, "/api/admin/categories"),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          12000
        );
        setCategories(payload);
      } catch (loadError) {
        if (loadError instanceof ApiRequestError && (loadError.status === 401 || loadError.status === 403)) {
          localStorage.removeItem("admin_token");
          router.push("/admin/login");
          return;
        }
        if (loadError instanceof ApiRequestError) {
          setError(loadError.traceId ? `${loadError.message}. Код: ${loadError.traceId}` : loadError.message);
        } else {
          setError("Не удалось загрузить категории. Обновите страницу.");
        }
      } finally {
        setCategoriesLoading(false);
      }
    }

    void loadCategories();
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const oldPriceRaw = formData.get("old_price");
    const oldPrice = oldPriceRaw ? parseFloat(String(oldPriceRaw)) : null;
    const discountLabel = String(formData.get("discount_label") || "").trim();
    const analogsRaw = String(formData.get("analogs") || "").trim();
    const analogs = analogsRaw
      ? analogsRaw.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

    const compatMake = String(formData.get("compat_make") || "").trim();
    const compatModel = String(formData.get("compat_model") || "").trim();
    const compatYearFromRaw = String(formData.get("compat_year_from") || "").trim();
    const compatYearToRaw = String(formData.get("compat_year_to") || "").trim();
    const compatEngine = String(formData.get("compat_engine") || "").trim();

    const compatibilities =
      compatMake && compatModel
        ? [
            {
              make: compatMake,
              model: compatModel,
              year_from: compatYearFromRaw ? parseInt(compatYearFromRaw, 10) : undefined,
              year_to: compatYearToRaw ? parseInt(compatYearToRaw, 10) : undefined,
              engine: compatEngine || undefined,
            },
          ]
        : [];

    const attributes: Record<string, unknown> = {};
    if (oldPrice !== null && Number.isFinite(oldPrice) && oldPrice > 0) {
      attributes.old_price = oldPrice;
    }
    if (discountLabel) {
      attributes.discount_label = discountLabel;
    }
    if (analogs.length > 0) {
      attributes.analogs = analogs;
    }

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
      attributes,
      images: [],
      compatibilities
    };

    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin/login");
        return;
      }
      const apiBaseUrl = getClientApiBaseUrl();
      
      const createdProduct = await fetchJsonWithTimeout<{ id: number }>(
        withApiBase(apiBaseUrl, "/api/admin/products"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        },
        12000
      );
      if (selectedImage) {
        const uploadData = new FormData();
        uploadData.set("file", selectedImage);

        const uploadedFile = await fetchJsonWithTimeout<{ url: string }>(
          withApiBase(apiBaseUrl, "/api/admin/upload"),
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
            },
            body: uploadData,
          },
          12000
        );
        await fetchJsonWithTimeout<{ id: number }>(
          withApiBase(apiBaseUrl, `/api/admin/products/${createdProduct.id}/images`),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
              url: uploadedFile.url,
              sort_order: 0,
              is_main: true,
            }),
          },
          12000
        );
      }

      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }
      if (err instanceof ApiRequestError) {
        setError(err.traceId ? `${err.message}. Код: ${err.traceId}` : err.message);
      } else {
        setError("Не удалось создать товар");
      }
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
              disabled={categoriesLoading}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            >
              <option value="">{categoriesLoading ? "Загрузка категорий..." : "Выберите категорию"}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
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
              Старая цена (для акции)
            </label>
            <input
              type="number"
              name="old_price"
              step="0.01"
              min="0"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Бейдж акции
            </label>
            <input
              type="text"
              name="discount_label"
              placeholder="Например: -15% / Акция"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Аналоги / кроссы (через запятую)
          </label>
          <input
            type="text"
            name="analogs"
            placeholder="Например: 06A905161B, 06A905161C"
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
          />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm font-medium text-neutral-700">Совместимость (1 позиция, опционально)</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              type="text"
              name="compat_make"
              placeholder="Марка (например, Mercedes)"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
            />
            <input
              type="text"
              name="compat_model"
              placeholder="Модель (например, Actros)"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
            />
            <input
              type="number"
              name="compat_year_from"
              placeholder="Год от"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
            />
            <input
              type="number"
              name="compat_year_to"
              placeholder="Год до"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
            />
            <input
              type="text"
              name="compat_engine"
              placeholder="Двигатель (опц.)"
              className="md:col-span-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Изображение товара
          </label>
          <input
            type="file"
            name="product_image"
            accept=".jpg,.jpeg,.png,.gif,.svg,.webp,image/*"
            onChange={(event) => setSelectedImage(event.target.files?.[0] ?? null)}
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 file:mr-4 file:rounded-xl file:border-0 file:bg-[#1F3B73] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#162c57] focus:border-[#1F3B73] focus:outline-none"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Файл сохранится локально в self-hosted `/uploads` без CDN.
          </p>
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
