'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type Category = {
  id: number;
  name: string;
};

type ProductCompatibility = {
  make: string;
  model: string;
  year_from?: number | null;
  year_to?: number | null;
  engine?: string | null;
};

type ProductPayload = {
  id: number;
  category_id: number;
  sku: string;
  oem: string | null;
  brand: string | null;
  name: string;
  description: string | null;
  price: number | null;
  stock_quantity: number;
  is_active: boolean;
  attributes?: Record<string, unknown>;
  compatibilities?: ProductCompatibility[];
};

type FormState = {
  category_id: string;
  sku: string;
  oem: string;
  brand: string;
  name: string;
  description: string;
  price: string;
  stock_quantity: string;
  is_active: boolean;
  old_price: string;
  discount_label: string;
  analogs: string;
  compat_make: string;
  compat_model: string;
  compat_year_from: string;
  compat_year_to: string;
  compat_engine: string;
};

const emptyFormState: FormState = {
  category_id: "",
  sku: "",
  oem: "",
  brand: "",
  name: "",
  description: "",
  price: "",
  stock_quantity: "0",
  is_active: true,
  old_price: "",
  discount_label: "",
  analogs: "",
  compat_make: "",
  compat_model: "",
  compat_year_from: "",
  compat_year_to: "",
  compat_engine: "",
};

function normalizeAnalogs(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").join(", ");
  }
  if (typeof value === "string") return value;
  return "";
}

export default function AdminProductEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const productId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [formState, setFormState] = useState<FormState>(emptyFormState);
  const [lastUpdated, setLastUpdated] = useState("");

  const isValidProductId = useMemo(() => Number.isInteger(productId) && productId > 0, [productId]);

  const loadData = useCallback(async () => {
    if (!isValidProductId) {
      setError("Некорректный ID товара");
      setLoading(false);
      return;
    }

    setError("");
    try {
      const apiBaseUrl = getClientApiBaseUrl();

      const [product, categoriesPayload] = await Promise.all([
        fetchJsonWithTimeout<ProductPayload>(
          withApiBase(apiBaseUrl, `/api/admin/products/${productId}`),
          {},
          12000
        ),
        fetchJsonWithTimeout<Category[]>(
          withApiBase(apiBaseUrl, "/api/admin/categories"),
          {},
          12000
        ),
      ]);

      setCategories(categoriesPayload);

      const compatibility = product.compatibilities?.[0];
      const oldPriceRaw = product.attributes?.old_price;
      const oldPrice =
        typeof oldPriceRaw === "number"
          ? String(oldPriceRaw)
          : typeof oldPriceRaw === "string"
            ? oldPriceRaw
            : "";
      const discountLabelRaw = product.attributes?.discount_label;
      const discountLabel = typeof discountLabelRaw === "string" ? discountLabelRaw : "";

      setFormState({
        category_id: String(product.category_id),
        sku: product.sku ?? "",
        oem: product.oem ?? "",
        brand: product.brand ?? "",
        name: product.name ?? "",
        description: product.description ?? "",
        price: product.price !== null ? String(product.price) : "",
        stock_quantity: String(product.stock_quantity ?? 0),
        is_active: product.is_active,
        old_price: oldPrice,
        discount_label: discountLabel,
        analogs: normalizeAnalogs(product.attributes?.analogs),
        compat_make: compatibility?.make ?? "",
        compat_model: compatibility?.model ?? "",
        compat_year_from: compatibility?.year_from ? String(compatibility.year_from) : "",
        compat_year_to: compatibility?.year_to ? String(compatibility.year_to) : "",
        compat_engine: compatibility?.engine ?? "",
      });
    } catch (loadError) {
      if (loadError instanceof ApiRequestError && (loadError.status === 401 || loadError.status === 403)) {
        router.push("/admin/login");
        return;
      }
      if (loadError instanceof ApiRequestError && loadError.status === 404) {
        setError("Товар не найден");
      } else if (loadError instanceof ApiRequestError) {
        setError(loadError.traceId ? `${loadError.message}. Код: ${loadError.traceId}` : loadError.message);
      } else {
        setError("Не удалось загрузить данные товара");
      }
    } finally {
      setLoading(false);
    }
  }, [isValidProductId, productId, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormState((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidProductId || isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const analogs = formState.analogs
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const attributes: Record<string, unknown> = {};
      if (formState.old_price.trim()) {
        attributes.old_price = Number(formState.old_price);
      }
      if (formState.discount_label.trim()) {
        attributes.discount_label = formState.discount_label.trim();
      }
      if (analogs.length > 0) {
        attributes.analogs = analogs;
      }

      const compatibilities =
        formState.compat_make.trim() && formState.compat_model.trim()
          ? [
              {
                make: formState.compat_make.trim(),
                model: formState.compat_model.trim(),
                year_from: formState.compat_year_from.trim() ? Number(formState.compat_year_from) : undefined,
                year_to: formState.compat_year_to.trim() ? Number(formState.compat_year_to) : undefined,
                engine: formState.compat_engine.trim() || undefined,
              },
            ]
          : [];

      const payload = {
        category_id: Number(formState.category_id),
        sku: formState.sku.trim(),
        oem: formState.oem.trim() || null,
        brand: formState.brand.trim() || null,
        name: formState.name.trim(),
        description: formState.description.trim() || null,
        price: formState.price.trim() ? Number(formState.price) : null,
        stock_quantity: Number(formState.stock_quantity || "0"),
        is_active: formState.is_active,
        attributes,
        compatibilities,
      };

      const apiBaseUrl = getClientApiBaseUrl();
      await fetchJsonWithTimeout<ProductPayload>(
        withApiBase(apiBaseUrl, `/api/admin/products/${productId}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        12000
      );

      setSuccess("Товар сохранён");
      setLastUpdated(new Date().toLocaleTimeString("ru-RU"));
    } catch (submitError) {
      if (submitError instanceof ApiRequestError && (submitError.status === 401 || submitError.status === 403)) {
        router.push("/admin/login");
        return;
      }
      if (submitError instanceof ApiRequestError) {
        setError(submitError.traceId ? `${submitError.message}. Код: ${submitError.traceId}` : submitError.message);
      } else {
        setError("Не удалось сохранить товар");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[#1F3B73]">Загрузка...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Link href="/admin/products" className="text-sm text-[#1F3B73] hover:underline">
          ← Назад к товарам
        </Link>
        <h1 className="break-words text-xl font-bold text-[#1F3B73] sm:text-2xl">Редактирование товара #{productId}</h1>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
          {lastUpdated ? <span className="ml-2 text-xs text-green-800">({lastUpdated})</span> : null}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Название *</label>
            <input
              type="text"
              value={formState.name}
              onChange={(event) => updateField("name", event.target.value)}
              required
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Категория *</label>
            <select
              value={formState.category_id}
              onChange={(event) => updateField("category_id", event.target.value)}
              required
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
            >
              <option value="">Выберите категорию</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">SKU *</label>
            <input
              type="text"
              value={formState.sku}
              onChange={(event) => updateField("sku", event.target.value)}
              required
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">OEM</label>
            <input
              type="text"
              value={formState.oem}
              onChange={(event) => updateField("oem", event.target.value)}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Бренд</label>
            <input
              type="text"
              value={formState.brand}
              onChange={(event) => updateField("brand", event.target.value)}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Цена</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formState.price}
              onChange={(event) => updateField("price", event.target.value)}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Старая цена</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formState.old_price}
              onChange={(event) => updateField("old_price", event.target.value)}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Остаток</label>
            <input
              type="number"
              value={formState.stock_quantity}
              onChange={(event) => updateField("stock_quantity", event.target.value)}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Бейдж акции</label>
            <input
              type="text"
              value={formState.discount_label}
              onChange={(event) => updateField("discount_label", event.target.value)}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Аналоги / кроссы</label>
            <input
              type="text"
              value={formState.analogs}
              onChange={(event) => updateField("analogs", event.target.value)}
              placeholder="Через запятую"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm font-medium text-neutral-700">Совместимость (1 запись)</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              type="text"
              value={formState.compat_make}
              onChange={(event) => updateField("compat_make", event.target.value)}
              placeholder="Марка"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={formState.compat_model}
              onChange={(event) => updateField("compat_model", event.target.value)}
              placeholder="Модель"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={formState.compat_year_from}
              onChange={(event) => updateField("compat_year_from", event.target.value)}
              placeholder="Год от"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={formState.compat_year_to}
              onChange={(event) => updateField("compat_year_to", event.target.value)}
              placeholder="Год до"
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={formState.compat_engine}
              onChange={(event) => updateField("compat_engine", event.target.value)}
              placeholder="Двигатель"
              className="md:col-span-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Описание</label>
          <textarea
            value={formState.description}
            onChange={(event) => updateField("description", event.target.value)}
            rows={5}
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={formState.is_active}
            onChange={(event) => updateField("is_active", event.target.checked)}
          />
          Активен (показывать на сайте)
        </label>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-[#FF7A00] px-6 py-3 font-medium text-white hover:bg-[#e66e00] disabled:opacity-60 sm:w-auto"
          >
            {isSubmitting ? "Сохранение..." : "Сохранить"}
          </button>
          <Link
            href={`/parts/p/${encodeURIComponent(formState.sku || "")}`}
            target="_blank"
            rel="noreferrer"
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-center text-sm text-neutral-700 hover:bg-neutral-50 sm:w-auto"
          >
            Открыть на сайте
          </Link>
        </div>
      </form>
    </div>
  );
}
