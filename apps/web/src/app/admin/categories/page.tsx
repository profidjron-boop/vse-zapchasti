"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import {
  redirectIfAdminUnauthorized,
  toAdminErrorMessage,
} from "@/components/admin/api-error";
import { fetchJsonWithTimeout } from "@/lib/fetch-json";
import { AdminTotalPagesFooter } from "@/components/admin/table-pagination-shared";
import { useAdminSearchPageState } from "@/components/admin/use-admin-search-page-state";

type Category = {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
};

const PAGE_SIZE = 50;

export default function AdminCategoriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [error, setError] = useState("");
  const { search, setSearch, page, setPage, pageInput, setPageInput } =
    useAdminSearchPageState({
      searchParams,
      router,
      basePath: "/admin/categories",
    });

  const fetchCategories = useCallback(
    async (showRefreshing = false) => {
      setError("");
      if (showRefreshing) {
        setIsRefreshing(true);
      }
      try {
        const apiBaseUrl = getClientApiBaseUrl();
        const data = await fetchJsonWithTimeout<Category[]>(
          withApiBase(apiBaseUrl, "/api/admin/categories"),
          {},
          12000,
        );
        setCategories(data);
        setLastUpdated(new Date().toLocaleTimeString("ru-RU"));
      } catch (fetchError) {
        if (redirectIfAdminUnauthorized(fetchError, router)) {
          return;
        }
        setError(toAdminErrorMessage(fetchError, "Ошибка загрузки категорий"));
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  const filteredCategories = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return categories;
    return categories.filter((category) =>
      `${category.name} ${category.slug}`
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [categories, search]);

  const totalPages = useMemo(() => {
    if (filteredCategories.length <= 0) return 1;
    return Math.ceil(filteredCategories.length / PAGE_SIZE);
  }, [filteredCategories.length]);

  const pagedCategories = useMemo(() => {
    const offset = (page - 1) * PAGE_SIZE;
    return filteredCategories.slice(offset, offset + PAGE_SIZE);
  }, [filteredCategories, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, setPage, totalPages]);

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
          Управление категориями
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchCategories(true)}
            disabled={isRefreshing}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            {isRefreshing ? "Обновление..." : "Обновить"}
          </button>
          <Link
            href="/admin/categories/new"
            className="rounded-2xl bg-[#FF7A00] px-4 py-2 text-sm font-medium text-white hover:bg-[#e66e00]"
          >
            + Добавить категорию
          </Link>
        </div>
      </div>
      {lastUpdated && (
        <div className="mb-4 text-xs text-neutral-500">
          Обновлено: {lastUpdated}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
          Поиск
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Название или slug"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none md:flex-1"
          />
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setPage(1);
            }}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-medium uppercase tracking-wide text-neutral-600 hover:bg-neutral-100"
          >
            Сбросить
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

      {filteredCategories.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white py-12 text-center text-neutral-500">
          {categories.length === 0 ? (
            <>
              <p>Категорий пока нет</p>
              <p className="mt-2 text-sm">
                Добавьте первую категорию через кнопку выше
              </p>
            </>
          ) : (
            <>
              <p>По текущему фильтру категории не найдены</p>
              <p className="mt-2 text-sm">Измените поисковый запрос</p>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-200 px-4 py-3 text-sm text-neutral-500">
            Показано: {pagedCategories.length} из {filteredCategories.length} ·
            Страница {page} из {totalPages}
          </div>

          <div className="divide-y divide-neutral-200 md:hidden">
            {pagedCategories.map((category) => (
              <article key={category.id} className="space-y-2 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-500">
                      ID: {category.id}
                    </p>
                    <p className="mt-1 font-medium text-neutral-900">
                      {category.name}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-xs ${
                      category.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {category.is_active ? "Да" : "Нет"}
                  </span>
                </div>
                <p className="break-all font-mono text-sm text-neutral-700">
                  {category.slug}
                </p>
                <p className="text-sm text-neutral-700">
                  Сортировка: {category.sort_order}
                </p>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Название
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Сортировка
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">
                    Активна
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {pagedCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {category.id}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {category.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">
                      {category.slug}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {category.sort_order}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          category.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {category.is_active ? "Да" : "Нет"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AdminTotalPagesFooter
            summary="Поиск выполняется по всем категориям."
            page={page}
            totalPages={totalPages}
            pageInput={pageInput}
            jumpInputId="categories-page-jump"
            onPageInputChange={setPageInput}
            onPrevPage={() => setPage((prev) => Math.max(1, prev - 1))}
            onNextPage={() =>
              setPage((prev) => Math.min(totalPages, prev + 1))
            }
            onJumpToPage={handlePageJump}
          />
        </div>
      )}
    </div>
  );
}
