'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type Product = {
  id: number;
  sku: string;
  oem: string | null;
  brand: string | null;
  name: string;
  description: string | null;
  price: number | null;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "out_of_stock">("all");

  const fetchProducts = useCallback(async (showRefreshing = false) => {
    setError("");
    if (showRefreshing) {
      setIsRefreshing(true);
    }

    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const data = await fetchJsonWithTimeout<Product[]>(
        withApiBase(apiBaseUrl, "/api/admin/products?limit=100"),
        {},
        12000
      );
      setProducts(data);
      setLastUpdated(new Date().toLocaleTimeString("ru-RU"));
    } catch (fetchError) {
      if (fetchError instanceof ApiRequestError && (fetchError.status === 401 || fetchError.status === 403)) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }
      if (fetchError instanceof ApiRequestError) {
        setError(fetchError.traceId ? `${fetchError.message}. Код: ${fetchError.traceId}` : fetchError.message);
      } else {
        setError("Не удалось загрузить список товаров");
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return products.filter((product) => {
      const stockMatches =
        stockFilter === "all" ||
        (stockFilter === "in_stock" && product.stock_quantity > 0) ||
        (stockFilter === "out_of_stock" && product.stock_quantity <= 0);

      if (!stockMatches) return false;
      if (!normalizedSearch) return true;

      return [product.sku, product.oem, product.brand, product.name]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [products, search, stockFilter]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[#1F3B73]">Загрузка...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1F3B73]">Управление товарами</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchProducts(true)}
            disabled={isRefreshing}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            {isRefreshing ? "Обновление..." : "Обновить"}
          </button>
          <Link
            href="/admin/products/new"
            className="rounded-2xl bg-[#FF7A00] px-4 py-2 text-sm font-medium text-white hover:bg-[#e66e00]"
          >
            + Добавить товар
          </Link>
        </div>
      </div>

      {lastUpdated && (
        <div className="mb-4 text-xs text-neutral-500">Обновлено: {lastUpdated}</div>
      )}

      <div className="mb-6 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">Поиск</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="SKU, OEM, бренд или название"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">Наличие</label>
          <select
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value as "all" | "in_stock" | "out_of_stock")}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          >
            <option value="all">Все</option>
            <option value="in_stock">В наличии</option>
            <option value="out_of_stock">Под заказ</option>
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white py-12 text-center text-neutral-500">
          {products.length === 0 ? (
            <>
              <p>Товаров пока нет</p>
              <p className="mt-2 text-sm">Добавьте первый товар через кнопку выше</p>
            </>
          ) : (
            <>
              <p>По текущему фильтру товары не найдены</p>
              <p className="mt-2 text-sm">Измените параметры поиска или фильтр по наличию</p>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-4 py-3 text-sm text-neutral-500">
            Найдено товаров: {filteredProducts.length}
          </div>

          <div className="divide-y divide-neutral-200 md:hidden">
            {filteredProducts.map((product) => (
              <article key={product.id} className="space-y-3 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all text-xs text-neutral-500">{product.sku}</p>
                    <p className="mt-1 font-medium text-neutral-900">{product.name}</p>
                    <p className="mt-1 text-sm text-neutral-600">OEM: {product.oem || "—"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${product.is_active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"}`}>
                    {product.is_active ? "Активен" : "Выключен"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-neutral-700">
                  <p>Бренд: {product.brand || "—"}</p>
                  <p>Остаток: {product.stock_quantity}</p>
                  <p className="col-span-2">Цена: {product.price ? `${product.price.toLocaleString()} ₽` : "—"}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="rounded-lg border border-[#1F3B73]/20 bg-white px-2 py-1 text-xs font-medium text-[#1F3B73] hover:bg-[#1F3B73]/5"
                  >
                    Редактировать
                  </Link>
                  <Link
                    href={`/parts/p/${encodeURIComponent(product.sku)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    На сайте
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">SKU</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">OEM</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Название</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Бренд</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Цена</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Остаток</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Статус</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{product.sku}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{product.oem || "—"}</td>
                    <td className="px-4 py-3 text-sm font-medium">{product.name}</td>
                    <td className="px-4 py-3 text-sm">{product.brand || "—"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{product.price ? `${product.price.toLocaleString()} ₽` : "—"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{product.stock_quantity}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span className={`rounded-full px-2 py-1 text-xs ${product.is_active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"}`}>
                        {product.is_active ? "Активен" : "Выключен"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="rounded-lg border border-[#1F3B73]/20 bg-white px-2 py-1 text-xs font-medium text-[#1F3B73] hover:bg-[#1F3B73]/5"
                        >
                          Редактировать
                        </Link>
                        <Link
                          href={`/parts/p/${encodeURIComponent(product.sku)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                        >
                          На сайте
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
