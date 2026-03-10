"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { normalizePage } from "@/components/admin/pagination-utils";
import {
  redirectIfAdminUnauthorized,
  toAdminErrorMessage,
} from "@/components/admin/api-error";
import {
  fetchJsonWithTimeoutAndResponse,
} from "@/lib/fetch-json";

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

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

function normalizeStockFilter(
  value: string | null,
): "all" | "in_stock" | "out_of_stock" {
  if (value === "in_stock" || value === "out_of_stock") {
    return value;
  }
  return "all";
}

function normalizePageSize(value: string | null): number {
  const parsed = Number.parseInt(value || "", 10);
  if (
    PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])
  ) {
    return parsed;
  }
  return DEFAULT_PAGE_SIZE;
}

export default function AdminProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [page, setPage] = useState(() =>
    normalizePage(searchParams.get("page")),
  );
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState(() =>
    (searchParams.get("q") || "").trim(),
  );
  const [stockFilter, setStockFilter] = useState<
    "all" | "in_stock" | "out_of_stock"
  >(() => normalizeStockFilter(searchParams.get("stock")));
  const [pageSize, setPageSize] = useState<number>(() =>
    normalizePageSize(searchParams.get("page_size")),
  );
  const [pageInput, setPageInput] = useState(() =>
    String(normalizePage(searchParams.get("page"))),
  );

  const fetchProducts = useCallback(
    async (showRefreshing = false) => {
      setError("");
      if (showRefreshing) {
        setIsRefreshing(true);
      }

      try {
        const apiBaseUrl = getClientApiBaseUrl();
        const searchParams = new URLSearchParams({
          limit: String(pageSize),
          skip: String((page - 1) * pageSize),
        });
        const normalizedSearch = search.trim();
        if (normalizedSearch) {
          searchParams.set("search", normalizedSearch);
        }
        if (stockFilter !== "all") {
          searchParams.set("stock", stockFilter);
        }

        const { data, response } = await fetchJsonWithTimeoutAndResponse<
          Product[]
        >(
          withApiBase(
            apiBaseUrl,
            `/api/admin/products?${searchParams.toString()}`,
          ),
          {},
          12000,
        );
        setProducts(data);
        const totalHeader = Number.parseInt(
          response.headers.get("x-total-count") || "",
          10,
        );
        setTotalProducts(
          Number.isFinite(totalHeader) ? totalHeader : data.length,
        );
        setLastUpdated(new Date().toLocaleTimeString("ru-RU"));
      } catch (fetchError) {
        if (redirectIfAdminUnauthorized(fetchError, router)) {
          return;
        }
        setError(
          toAdminErrorMessage(fetchError, "Не удалось загрузить список товаров"),
        );
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [router, search, stockFilter, page, pageSize],
  );

  useEffect(() => {
    const nextSearch = (searchParams.get("q") || "").trim();
    const nextStockFilter = normalizeStockFilter(searchParams.get("stock"));
    const nextPageSize = normalizePageSize(searchParams.get("page_size"));
    const nextPage = normalizePage(searchParams.get("page"));

    setSearch((prev) => (prev === nextSearch ? prev : nextSearch));
    setStockFilter((prev) =>
      prev === nextStockFilter ? prev : nextStockFilter,
    );
    setPageSize((prev) => (prev === nextPageSize ? prev : nextPageSize));
    setPage((prev) => (prev === nextPage ? prev : nextPage));
  }, [searchParams]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchProducts();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [fetchProducts]);

  const totalPages = useMemo(() => {
    if (totalProducts <= 0) return 1;
    return Math.ceil(totalProducts / pageSize);
  }, [totalProducts, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    const query = new URLSearchParams();
    const normalizedSearch = search.trim();
    if (normalizedSearch) {
      query.set("q", normalizedSearch);
    }
    if (stockFilter !== "all") {
      query.set("stock", stockFilter);
    }
    if (pageSize !== DEFAULT_PAGE_SIZE) {
      query.set("page_size", String(pageSize));
    }
    if (page > 1) {
      query.set("page", String(page));
    }
    const target = query.toString()
      ? `/admin/products?${query.toString()}`
      : "/admin/products";
    router.replace(target, { scroll: false });
  }, [page, pageSize, router, search, stockFilter]);

  function handlePageJump(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number.parseInt(pageInput, 10);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(page));
      return;
    }
    const nextPage = Math.max(1, Math.min(totalPages, parsed));
    setPage(nextPage);
    setPageInput(String(nextPage));
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1F3B73]">
          Управление товарами
        </h1>
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
        <div className="mb-4 text-xs text-neutral-500">
          Обновлено: {lastUpdated}
        </div>
      )}

      <div className="mb-6 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Поиск
          </label>
          <input
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="SKU, OEM, бренд или название"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Наличие
          </label>
          <select
            value={stockFilter}
            onChange={(event) => {
              setStockFilter(
                event.target.value as "all" | "in_stock" | "out_of_stock",
              );
              setPage(1);
            }}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          >
            <option value="all">Все</option>
            <option value="in_stock">В наличии</option>
            <option value="out_of_stock">Под заказ</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
            На странице
          </label>
          <select
            value={String(pageSize)}
            onChange={(event) => {
              setPageSize(
                Number.parseInt(event.target.value, 10) || DEFAULT_PAGE_SIZE,
              );
              setPage(1);
            }}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStockFilter("all");
              setPageSize(DEFAULT_PAGE_SIZE);
              setPage(1);
            }}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium uppercase tracking-wide text-neutral-600 hover:bg-neutral-100"
          >
            Сбросить фильтры
          </button>
        </div>
      </div>

      <div className="mb-6 min-h-[4.5rem]">
        {error ? (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600"
          >
            {error}
          </div>
        ) : null}
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white py-12 text-center text-neutral-500">
          {totalProducts === 0 ? (
            <>
              <p>Товаров пока нет</p>
              <p className="mt-2 text-sm">
                Добавьте первый товар через кнопку выше
              </p>
            </>
          ) : (
            <>
              <p>На этой странице товаров нет</p>
              <p className="mt-2 text-sm">
                Попробуйте перейти на предыдущую страницу или изменить фильтры
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-4 py-3 text-sm text-neutral-500">
            Показано: {products.length} из {totalProducts} · Страница {page} из{" "}
            {totalPages}
          </div>

          <div className="divide-y divide-neutral-200 md:hidden">
            {products.map((product) => (
              <article key={product.id} className="space-y-3 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all text-xs text-neutral-500">
                      {product.sku}
                    </p>
                    <p className="mt-1 font-medium text-neutral-900">
                      {product.name}
                    </p>
                    <p className="mt-1 text-sm text-neutral-600">
                      OEM: {product.oem || "—"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-xs ${product.is_active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"}`}
                  >
                    {product.is_active ? "Активен" : "Выключен"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-neutral-700">
                  <p>Бренд: {product.brand || "—"}</p>
                  <p>Остаток: {product.stock_quantity}</p>
                  <p className="col-span-2">
                    Цена:{" "}
                    {typeof product.price === "number"
                      ? `${product.price.toLocaleString("ru-RU")} ₽`
                      : "Цена по запросу"}
                  </p>
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    OEM
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Название
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Бренд
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Цена
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Остаток
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Статус
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {product.sku}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {product.oem || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {product.brand || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {typeof product.price === "number"
                        ? `${product.price.toLocaleString("ru-RU")} ₽`
                        : "Цена по запросу"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {product.stock_quantity}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${product.is_active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"}`}
                      >
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

          {totalProducts > 0 ? (
            <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-sm">
              <div className="text-neutral-500">
                Поиск работает по всему каталогу, не только по текущей странице.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                >
                  Назад
                </button>
                <span className="min-w-[7rem] text-center text-neutral-600">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={page >= totalPages}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                >
                  Вперёд
                </button>
                <form
                  onSubmit={handlePageJump}
                  className="ml-1 flex items-center gap-2"
                >
                  <label
                    htmlFor="products-page-jump"
                    className="text-xs text-neutral-500"
                  >
                    Стр.
                  </label>
                  <input
                    id="products-page-jump"
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageInput}
                    onChange={(event) => setPageInput(event.target.value)}
                    className="w-20 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-700 focus:border-[#1F3B73] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100"
                  >
                    Перейти
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
