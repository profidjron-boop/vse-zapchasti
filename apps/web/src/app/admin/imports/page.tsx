'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";

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
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState<ImportResponse | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [updateMode, setUpdateMode] = useState<UpdateMode>("manual");
  const [isSavingMode, setIsSavingMode] = useState(false);
  const [modeMessage, setModeMessage] = useState("");

  const createdLabel = useMemo(() => {
    if (!uploadResult) return "";
    return `Запуск #${uploadResult.run_id}: создано ${uploadResult.created}, обновлено ${uploadResult.updated}, ошибок ${uploadResult.failed}`;
  }, [uploadResult]);

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
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin/login");
        return;
      }

      const apiBaseUrl = getClientApiBaseUrl();
      const response = await fetch(withApiBase(apiBaseUrl, "/api/admin/imports?limit=100"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }
      if (!response.ok) {
        throw new Error("Не удалось загрузить список импортов");
      }

      const data = (await response.json()) as ImportRun[];
      setRuns(data);

      const modeResponse = await fetch(withApiBase(apiBaseUrl, "/api/admin/content/import_products_update_mode"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (modeResponse.ok) {
        const modePayload = (await modeResponse.json()) as { value?: string };
        setUpdateMode(normalizeUpdateMode(modePayload.value));
      } else if (modeResponse.status === 404) {
        setUpdateMode("manual");
      }

      setLastUpdated(new Date().toLocaleTimeString("ru-RU"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить список импортов");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  const filteredRuns = useMemo(() => {
    if (!statusFilter) return runs;
    return runs.filter((run) => run.status === statusFilter);
  }, [runs, statusFilter]);

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
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin/login");
        return;
      }

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

      const response = await fetch(withApiBase(apiBaseUrl, endpoint), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.status === 401) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Error(payload.detail || "Не удалось выполнить импорт");
      }

      const result = (await response.json()) as ImportResponse;
      setUploadResult(result);
      setFile(null);
      await fetchRuns();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Ошибка при загрузке файла");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSaveUpdateMode() {
    setModeMessage("");
    setError("");

    try {
      setIsSavingMode(true);
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin/login");
        return;
      }

      const apiBaseUrl = getClientApiBaseUrl();
      const payload = {
        key: "import_products_update_mode",
        value: updateMode,
        type: "text",
        description: "Режим обновления каталога: manual/hourly/daily/event",
      };

      const updateResponse = await fetch(withApiBase(apiBaseUrl, "/api/admin/content/import_products_update_mode"), {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          value: payload.value,
          type: payload.type,
          description: payload.description,
        }),
      });

      if (updateResponse.status === 404) {
        const createResponse = await fetch(withApiBase(apiBaseUrl, "/api/admin/content"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!createResponse.ok) {
          const body = (await createResponse.json().catch(() => null)) as { detail?: string } | null;
          throw new Error(body?.detail || "Не удалось сохранить режим обновления");
        }
      } else if (!updateResponse.ok) {
        const body = (await updateResponse.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail || "Не удалось сохранить режим обновления");
      }

      setModeMessage("Режим обновления сохранён");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить режим обновления");
    } finally {
      setIsSavingMode(false);
    }
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
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
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
        </div>

        {uploadError && <p className="mt-3 text-sm text-red-600">{uploadError}</p>}
        {uploadResult && (
          <p className="mt-3 text-sm text-green-700">
            {createdLabel}{" "}
            <Link href={`/admin/imports/${uploadResult.run_id}`} className="font-medium underline">
              Открыть детали
            </Link>
          </p>
        )}
      </form>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-neutral-500">Загрузка...</div>
      ) : runs.length === 0 ? (
        <div className="py-12 text-center text-neutral-500">Запусков импорта пока нет</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-neutral-500">Найдено запусков: {filteredRuns.length}</div>
            <div className="flex items-center gap-2">
              <label className="text-xs uppercase tracking-wide text-neutral-500">Статус</label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
              >
                <option value="">Все</option>
                <option value="finished">Завершён</option>
                <option value="failed">Ошибка</option>
                <option value="started">Выполняется</option>
              </select>
            </div>
          </div>
          <table className="w-full">
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
              {filteredRuns.map((run) => (
                <tr key={run.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm">
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
                  <td className="px-4 py-3 text-sm">{run.source || "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    {run.created_by_user || (run.created_by ? `#${run.created_by}` : "—")}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {run.created}/{run.updated}/{run.failed}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/admin/imports/${run.id}`} className="text-[#1F3B73] hover:underline">
                      Открыть
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
