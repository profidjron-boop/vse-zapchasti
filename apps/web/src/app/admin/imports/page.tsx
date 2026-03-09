'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type ImportRun = {
  id: number;
  entity_type: string;
  status: string;
  source: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_by: number | null;
  created_by_user: string | null;
  created: number;
  updated: number;
  failed: number;
};

type ImportResponse = {
  run_id: number;
  created: number;
  updated: number;
  failed: number;
};

type UpdateMode = "manual" | "hourly" | "daily" | "event";
const PAGE_SIZE = 25;

function normalizeUpdateMode(value: string | null | undefined): UpdateMode {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "hourly" || normalized === "daily" || normalized === "event") {
    return normalized;
  }
  return "manual";
}

export default function AdminImportsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isTriggeringSource, setIsTriggeringSource] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState<ImportResponse | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [pageInput, setPageInput] = useState("1");
  const [updateMode, setUpdateMode] = useState<UpdateMode>("manual");
  const [isSavingMode, setIsSavingMode] = useState(false);
  const [modeMessage, setModeMessage] = useState("");
  const [showTechnicalCommand, setShowTechnicalCommand] = useState(false);

  const createdLabel = useMemo(() => {
    if (!uploadResult) return "";
    return `Запуск #${uploadResult.run_id}: создано ${uploadResult.created}, обновлено ${uploadResult.updated}, ошибок ${uploadResult.failed}`;
  }, [uploadResult]);

  const modeHint = useMemo(() => {
    switch (updateMode) {
      case "hourly":
        return {
          text: "Для режима «раз в час» настройте cron/systemd timer и вызывайте скрипт с hourly.",
          command: "IMPORT_MODE=hourly IMPORT_FILE_PATH=./imports/products.xlsx ADMIN_TOKEN=... bash scripts/import-products.sh",
        };
      case "daily":
        return {
          text: "Для режима «раз в сутки» запускайте тот же скрипт один раз в день через scheduler.",
          command: "IMPORT_MODE=daily IMPORT_FILE_PATH=./imports/products.xlsx ADMIN_TOKEN=... bash scripts/import-products.sh",
        };
      case "event":
        return {
          text: "Для режима «по событию» внешний триггер должен явно передать флаг --event.",
          command: "IMPORT_MODE=event IMPORT_SOURCE_URL=https://erp.example/export.xlsx ADMIN_TOKEN=... bash scripts/import-products.sh --event",
        };
      default:
        return {
          text: "В ручном режиме импорт запускается только из этой страницы или прямым вызовом скрипта.",
          command: "IMPORT_MODE=manual IMPORT_FILE_PATH=./imports/products.xlsx ADMIN_TOKEN=... bash scripts/import-products.sh",
        };
    }
  }, [updateMode]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "finished":
        return "Завершён";
      case "failed":
        return "С ошибкой";
      case "started":
        return "Выполняется";
      default:
        return status;
    }
  };

  const fetchRuns = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    }

    try {
      setError("");
      const apiBaseUrl = getClientApiBaseUrl();
      const query = new URLSearchParams({
        skip: String((page - 1) * PAGE_SIZE),
        limit: String(PAGE_SIZE + 1),
      });
      if (statusFilter) {
        query.set("status", statusFilter);
      }
      const data = await fetchJsonWithTimeout<ImportRun[]>(
        withApiBase(apiBaseUrl, `/api/admin/imports?${query.toString()}`),
        {},
        12000
      );
      const nextPageAvailable = data.length > PAGE_SIZE;
      const pageRows = nextPageAvailable ? data.slice(0, PAGE_SIZE) : data;
      setRuns(pageRows);
      setHasNextPage(nextPageAvailable);

      try {
        const modePayload = await fetchJsonWithTimeout<{ value?: string }>(
          withApiBase(apiBaseUrl, "/api/admin/content/import_products_update_mode"),
          {},
          12000
        );
        setUpdateMode(normalizeUpdateMode(modePayload.value));
      } catch (modeError) {
        if (modeError instanceof ApiRequestError && modeError.status === 404) {
          setUpdateMode("manual");
        } else if (modeError instanceof ApiRequestError && (modeError.status === 401 || modeError.status === 403)) {
          throw modeError;
        }
      }

      setLastUpdated(new Date().toLocaleTimeString("ru-RU"));
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        router.push("/admin/login");
        return;
      }
      if (err instanceof ApiRequestError) {
        setError(err.traceId ? `${err.message}. Код: ${err.traceId}` : err.message);
      } else {
        setError("Не удалось загрузить список импортов");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [page, router, statusFilter]);

  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  async function refreshRunsAfterMutation() {
    if (page !== 1) {
      setPage(1);
      return;
    }
    await fetchRuns();
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError("");
    setUploadResult(null);

    if (!file) {
      setUploadError("Выберите файл CSV или XLSX");
      return;
    }

    try {
      setIsUploading(true);
      const params = new URLSearchParams();
      if (defaultCategoryId.trim()) {
        params.set("default_category_id", defaultCategoryId.trim());
      }

      const formData = new FormData();
      formData.set("file", file);

      const apiBaseUrl = getClientApiBaseUrl();
      const endpoint = params.toString()
        ? `/api/admin/products/import?${params.toString()}`
        : "/api/admin/products/import";

      const result = await fetchJsonWithTimeout<ImportResponse>(
        withApiBase(apiBaseUrl, endpoint),
        {
          method: "POST",
          body: formData,
        },
        12000
      );
      setUploadResult(result);
      setFile(null);
      await refreshRunsAfterMutation();
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        router.push("/admin/login");
        return;
      }
      if (err instanceof ApiRequestError) {
        setUploadError(err.traceId ? `${err.message}. Код: ${err.traceId}` : err.message);
      } else {
        setUploadError("Ошибка при загрузке файла");
      }
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSourceTrigger() {
    setUploadError("");
    setUploadResult(null);

    try {
      setIsTriggeringSource(true);
      const params = new URLSearchParams();
      params.set("trigger_mode", updateMode);
      if (defaultCategoryId.trim()) {
        params.set("default_category_id", defaultCategoryId.trim());
      }

      const apiBaseUrl = getClientApiBaseUrl();
      const endpoint = `/api/admin/products/import-from-source?${params.toString()}`;
      const result = await fetchJsonWithTimeout<ImportResponse>(
        withApiBase(apiBaseUrl, endpoint),
        {
          method: "POST",
        },
        12000
      );
      setUploadResult(result);
      await refreshRunsAfterMutation();
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        router.push("/admin/login");
        return;
      }
      if (err instanceof ApiRequestError) {
        setUploadError(err.traceId ? `${err.message}. Код: ${err.traceId}` : err.message);
      } else {
        setUploadError("Ошибка запуска импорта из источника");
      }
    } finally {
      setIsTriggeringSource(false);
    }
  }

  async function handleSaveUpdateMode() {
    setModeMessage("");
    setError("");

    try {
      setIsSavingMode(true);
      const apiBaseUrl = getClientApiBaseUrl();
      const payload = {
        key: "import_products_update_mode",
        value: updateMode,
        type: "text",
        description: "Режим обновления каталога: manual/hourly/daily/event",
      };

      try {
        await fetchJsonWithTimeout<{ key: string; value: string }>(
          withApiBase(apiBaseUrl, "/api/admin/content/import_products_update_mode"),
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              value: payload.value,
              type: payload.type,
              description: payload.description,
            }),
          },
          12000
        );
      } catch (updateError) {
        if (!(updateError instanceof ApiRequestError) || updateError.status !== 404) {
          throw updateError;
        }
        await fetchJsonWithTimeout<{ key: string; value: string }>(
          withApiBase(apiBaseUrl, "/api/admin/content"),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
          12000
        );
      }

      setModeMessage("Режим обновления сохранён");
    } catch (saveError) {
      if (saveError instanceof ApiRequestError && (saveError.status === 401 || saveError.status === 403)) {
        router.push("/admin/login");
        return;
      }
      if (saveError instanceof ApiRequestError) {
        setError(saveError.traceId ? `${saveError.message}. Код: ${saveError.traceId}` : saveError.message);
      } else {
        setError("Не удалось сохранить режим обновления");
      }
    } finally {
      setIsSavingMode(false);
    }
  }

  function handlePageJump(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number.parseInt(pageInput, 10);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(page));
      return;
    }
    const nextPage = Math.max(1, parsed);
    setPage(nextPage);
    setPageInput(String(nextPage));
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1F3B73]">Импорты каталога</h1>
            <p className="mt-2 text-sm text-neutral-600">
              История запусков импорта и загрузка нового CSV/XLSX файла.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchRuns(true)}
            disabled={isRefreshing}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            {isRefreshing ? "Обновление..." : "Обновить"}
          </button>
        </div>
        {lastUpdated && <div className="mt-2 text-xs text-neutral-500">Обновлено: {lastUpdated}</div>}
      </div>

      <form onSubmit={handleUpload} className="mb-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Режим обновления</label>
              <select
                value={updateMode}
                onChange={(event) => setUpdateMode(normalizeUpdateMode(event.target.value))}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
              >
                <option value="manual">Ручной запуск</option>
                <option value="hourly">По расписанию: раз в час</option>
                <option value="daily">По расписанию: раз в сутки</option>
                <option value="event">По событию (внешний триггер)</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => void handleSaveUpdateMode()}
              disabled={isSavingMode}
              className="rounded-xl border border-[#1F3B73]/20 bg-white px-3 py-2 text-sm font-medium text-[#1F3B73] hover:bg-[#1F3B73]/5 disabled:opacity-50"
            >
              {isSavingMode ? "Сохранение..." : "Сохранить режим"}
            </button>
            {modeMessage ? <p className="text-sm text-green-700">{modeMessage}</p> : null}
          </div>
          <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-sm text-neutral-700">{modeHint.text}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTechnicalCommand((prev) => !prev)}
                aria-expanded={showTechnicalCommand}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
              >
                {showTechnicalCommand ? "Скрыть техкоманду" : "Показать техкоманду для интегратора"}
              </button>
              <span className="text-xs text-neutral-500">Нужно только техническому специалисту.</span>
            </div>
            {showTechnicalCommand ? (
              <code className="mt-2 block overflow-x-auto rounded-lg bg-neutral-900/95 px-3 py-2 text-xs text-neutral-100">
                {modeHint.command}
              </code>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_220px_auto_auto] md:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Файл импорта</label>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">ID категории по умолчанию</label>
            <input
              type="number"
              min={1}
              value={defaultCategoryId}
              onChange={(event) => setDefaultCategoryId(event.target.value)}
              placeholder="Опционально"
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isUploading}
            className="rounded-xl bg-[#FF7A00] px-4 py-2 text-sm font-medium text-white hover:bg-[#e66e00] disabled:opacity-50"
          >
            {isUploading ? "Загрузка..." : "Загрузить файл"}
          </button>
          <button
            type="button"
            onClick={() => void handleSourceTrigger()}
            disabled={isTriggeringSource}
            className="rounded-xl border border-[#1F3B73]/20 bg-white px-4 py-2 text-sm font-medium text-[#1F3B73] hover:bg-[#1F3B73]/5 disabled:opacity-50"
          >
            {isTriggeringSource ? "Запуск..." : "Запустить из источника"}
          </button>
        </div>

        {uploadError && <p role="alert" aria-live="assertive" className="mt-3 text-sm text-red-600">{uploadError}</p>}
        {uploadResult && (
          <p role="status" aria-live="polite" className="mt-3 text-sm text-green-700">
            {createdLabel}{" "}
            <Link href={`/admin/imports/${uploadResult.run_id}`} className="font-medium underline">
              Открыть детали
            </Link>
          </p>
        )}
      </form>

      {error && (
        <div role="alert" aria-live="assertive" className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-neutral-500">Загрузка...</div>
      ) : runs.length === 0 ? (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-neutral-500">
              {statusFilter ? "По выбранному статусу запусков нет" : "Запусков импорта пока нет"}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs uppercase tracking-wide text-neutral-500">Статус</label>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
              >
                <option value="">Все</option>
                <option value="finished">Завершён</option>
                <option value="failed">Ошибка</option>
                <option value="started">Выполняется</option>
              </select>
              {statusFilter ? (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("");
                    setPage(1);
                  }}
                  className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                >
                  Сбросить
                </button>
              ) : null}
            </div>
          </div>
          <div className="py-12 text-center text-neutral-500">
            {statusFilter ? "По выбранному статусу запусков нет" : "Запусков импорта пока нет"}
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-neutral-500">Показано запусков: {runs.length}</div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs uppercase tracking-wide text-neutral-500">Статус</label>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
              >
                <option value="">Все</option>
                <option value="finished">Завершён</option>
                <option value="failed">Ошибка</option>
                <option value="started">Выполняется</option>
              </select>
            </div>
          </div>
          <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 md:hidden">
            {runs.map((run) => (
              <article key={run.id} className="space-y-3 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-500">
                      {run.started_at ? new Date(run.started_at).toLocaleString("ru-RU") : "—"}
                    </p>
                    <p className="mt-1 break-all text-sm text-neutral-700">Источник: {run.source || "—"}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-xs ${
                      run.status === "finished"
                        ? "bg-green-100 text-green-700"
                        : run.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {getStatusLabel(run.status)}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1 text-sm text-neutral-700">
                  <p>Кто запустил: {run.created_by_user || (run.created_by ? `#${run.created_by}` : "—")}</p>
                  <p>Создано/Обновлено/Ошибок: {run.created}/{run.updated}/{run.failed}</p>
                </div>

                <Link href={`/admin/imports/${run.id}`} className="text-sm font-medium text-[#1F3B73] hover:underline">
                  Открыть детали
                </Link>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Дата</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Статус</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Источник</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Кто запустил</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Создано/Обновлено/Ошибок</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Детали</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {run.started_at ? new Date(run.started_at).toLocaleString("ru-RU") : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          run.status === "finished"
                            ? "bg-green-100 text-green-700"
                            : run.status === "failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {getStatusLabel(run.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{run.source || "—"}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {run.created_by_user || (run.created_by ? `#${run.created_by}` : "—")}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {run.created}/{run.updated}/{run.failed}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <Link href={`/admin/imports/${run.id}`} className="text-[#1F3B73] hover:underline">
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-sm">
            <div className="text-neutral-500">
              Показано запусков: {runs.length} · Страница {page}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || isRefreshing}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
              >
                Назад
              </button>
              <span className="min-w-[5rem] text-center text-neutral-600">Стр. {page}</span>
              <button
                type="button"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={!hasNextPage || isRefreshing}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
              >
                Вперёд
              </button>
              <form onSubmit={handlePageJump} className="ml-1 flex items-center gap-2">
                <label htmlFor="imports-page-jump" className="text-xs text-neutral-500">Стр.</label>
                <input
                  id="imports-page-jump"
                  type="number"
                  min={1}
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
        </div>
      )}
    </div>
  );
}
