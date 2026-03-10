export function normalizePage(value: string | null): number {
  const parsed = Number.parseInt(value || "1", 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 1;
}

export function applySearchAndPageQuery(
  query: URLSearchParams,
  search: string,
  page: number,
) {
  const normalizedSearch = search.trim();
  if (normalizedSearch) {
    query.set("q", normalizedSearch);
  }
  if (page > 1) {
    query.set("page", String(page));
  }
}

export function resolvePageFromInput(pageInput: string, currentPage: number): number {
  const parsed = Number.parseInt(pageInput, 10);
  if (!Number.isFinite(parsed)) {
    return currentPage;
  }
  return Math.max(1, parsed);
}
