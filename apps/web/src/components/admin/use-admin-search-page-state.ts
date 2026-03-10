import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  applySearchAndPageQuery,
  normalizePage,
  resolvePageFromInput,
} from "@/components/admin/pagination-utils";

type SearchParamsLike = {
  get: (name: string) => string | null;
};

type RouterLike = {
  replace: (href: string, options?: { scroll?: boolean }) => void;
};

type UseAdminSearchPageStateOptions = {
  searchParams: SearchParamsLike;
  router: RouterLike;
  basePath: string;
};

export function useAdminSearchPageState({
  searchParams,
  router,
  basePath,
}: UseAdminSearchPageStateOptions) {
  const [search, setSearch] = useState(() =>
    (searchParams.get("q") || "").trim(),
  );
  const [page, setPage] = useState(() =>
    normalizePage(searchParams.get("page")),
  );
  const [pageInput, setPageInput] = useState(() =>
    String(normalizePage(searchParams.get("page"))),
  );

  useEffect(() => {
    const nextSearch = (searchParams.get("q") || "").trim();
    const nextPage = normalizePage(searchParams.get("page"));
    setSearch((prev) => (prev === nextSearch ? prev : nextSearch));
    setPage((prev) => (prev === nextPage ? prev : nextPage));
  }, [searchParams]);

  useEffect(() => {
    const query = new URLSearchParams();
    applySearchAndPageQuery(query, search, page);
    const target = query.toString() ? `${basePath}?${query.toString()}` : basePath;
    router.replace(target, { scroll: false });
  }, [basePath, page, router, search]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  function handlePageJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextPage = resolvePageFromInput(pageInput, page);
    setPage(nextPage);
    setPageInput(String(nextPage));
  }

  return {
    search,
    setSearch,
    page,
    setPage,
    pageInput,
    setPageInput,
    handlePageJump,
  };
}
