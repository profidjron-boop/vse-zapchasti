import { useEffect, useState } from "react";
import {
  applySearchAndPageQuery,
  normalizePage,
  resolvePageFromInput,
} from "@/components/admin/pagination-utils";

export type RequestListFilters = {
  status: string;
  search: string;
};

export type FilterPreset = {
  id: string;
  name: string;
  filters: RequestListFilters;
};

type SearchParamsLike = {
  get: (name: string) => string | null;
};

type RouterLike = {
  replace: (href: string, options?: { scroll?: boolean }) => void;
};

type UseAdminRequestListStateOptions = {
  searchParams: SearchParamsLike;
  router: RouterLike;
  basePath: string;
  storageKey: string;
  setError: (value: string) => void;
  setSuccess: (value: string) => void;
};

export const DEFAULT_PAGE_SIZE = 25;

export function normalizePageSize(value: string | null): number {
  const parsed = Number.parseInt(value || "", 10);
  if (parsed === 25 || parsed === 50 || parsed === 100) {
    return parsed;
  }
  return DEFAULT_PAGE_SIZE;
}

export function useAdminRequestListState({
  searchParams,
  router,
  basePath,
  storageKey,
  setError,
  setSuccess,
}: UseAdminRequestListStateOptions) {
  const initialStatus = searchParams.get("status") || "";
  const initialSearch = (searchParams.get("q") || "").trim();
  const initialPage = normalizePage(searchParams.get("page"));
  const initialPageSize = normalizePageSize(searchParams.get("page_size"));

  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState(initialSearch);
  const [appliedFilters, setAppliedFilters] = useState<RequestListFilters>({
    status: initialStatus,
    search: initialSearch,
  });
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [pageInput, setPageInput] = useState(String(initialPage));

  useEffect(() => {
    const nextStatus = searchParams.get("status") || "";
    const nextSearch = (searchParams.get("q") || "").trim();
    const nextPage = normalizePage(searchParams.get("page"));
    const nextPageSize = normalizePageSize(searchParams.get("page_size"));

    setStatus((prev) => (prev === nextStatus ? prev : nextStatus));
    setSearch((prev) => (prev === nextSearch ? prev : nextSearch));
    setAppliedFilters((prev) =>
      prev.status === nextStatus && prev.search === nextSearch
        ? prev
        : { status: nextStatus, search: nextSearch },
    );
    setPage((prev) => (prev === nextPage ? prev : nextPage));
    setPageSize((prev) => (prev === nextPageSize ? prev : nextPageSize));
  }, [searchParams]);

  useEffect(() => {
    const query = new URLSearchParams();
    if (appliedFilters.status) {
      query.set("status", appliedFilters.status);
    }
    if (pageSize !== DEFAULT_PAGE_SIZE) {
      query.set("page_size", String(pageSize));
    }
    applySearchAndPageQuery(query, appliedFilters.search, page);
    const target = query.toString() ? `${basePath}?${query.toString()}` : basePath;
    router.replace(target, { scroll: false });
  }, [appliedFilters.search, appliedFilters.status, basePath, page, pageSize, router]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as FilterPreset[];
      if (Array.isArray(parsed)) {
        setPresets(parsed);
      }
    } catch (err) {
      console.error(err);
    }
  }, [storageKey]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  function handleApplyFilters(event: React.FormEvent) {
    event.preventDefault();
    setAppliedFilters({ status, search });
    setPage(1);
  }

  function handleResetFilters() {
    setStatus("");
    setSearch("");
    setAppliedFilters({ status: "", search: "" });
    setPage(1);
    setError("");
  }

  function handlePageJump(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextPage = resolvePageFromInput(pageInput, page);
    setPage(nextPage);
    setPageInput(String(nextPage));
  }

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) {
      setError("Введите имя пресета");
      return;
    }
    const preset: FilterPreset = {
      id: `${Date.now()}`,
      name,
      filters: { status, search },
    };
    const next = [preset, ...presets];
    setPresets(next);
    setPresetName("");
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSuccess(`Пресет "${name}" сохранён`);
  };

  const handleApplyPreset = () => {
    const preset = presets.find((item) => item.id === selectedPresetId);
    if (!preset) {
      setError("Выберите пресет");
      return;
    }
    setStatus(preset.filters.status);
    setSearch(preset.filters.search);
    setAppliedFilters(preset.filters);
    setPage(1);
    setSuccess(`Применён пресет "${preset.name}"`);
  };

  const handleDeletePreset = () => {
    if (!selectedPresetId) {
      setError("Выберите пресет для удаления");
      return;
    }
    const next = presets.filter((item) => item.id !== selectedPresetId);
    setPresets(next);
    setSelectedPresetId("");
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSuccess("Пресет удалён");
  };

  return {
    status,
    setStatus,
    search,
    setSearch,
    appliedFilters,
    presets,
    presetName,
    setPresetName,
    selectedPresetId,
    setSelectedPresetId,
    page,
    setPage,
    pageSize,
    setPageSize,
    pageInput,
    setPageInput,
    handleApplyFilters,
    handleResetFilters,
    handlePageJump,
    handleSavePreset,
    handleApplyPreset,
    handleDeletePreset,
  };
}
