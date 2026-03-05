'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";

type ImportRunDetails = {
  id: number;
  entity_type: string;
  status: string;
  source: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_by: number | null;
  created_by_user: string | null;
  total: number;
  created: number;
  updated: number;
  failed: number;
  summary: Record<string, unknown>;
  errors: string[];
  previous_successful_run: {
    id: number;
    status: string;
    source: string | null;
    finished_at: string | null;
  } | null;
  snapshot_metadata: {
    items_count: number;
    has_snapshot: boolean;
    sample_keys: string[];
  };
};

export default function ImportRunDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<ImportRunDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRun = async () => {
      try {
        setError("");
        const token = localStorage.getItem("admin_token");
        if (!token) {
          router.push("/admin/login");
          return;
        }

        const apiBaseUrl = getClientApiBaseUrl();
        const response = await fetch(withApiBase(apiBaseUrl, `/api/admin/imports/${params.id}`), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          localStorage.removeItem("admin_token");
          router.push("/admin/login");
          return;
        }
        if (response.status === 404) {
          setError("Run не найден");
          return;
        }
        if (!response.ok) {
          throw new Error("Не удалось загрузить детали импорта");
        }

        const data = (await response.json()) as ImportRunDetails;
        setRun(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить детали импорта");
      } finally {
        setIsLoading(false);
      }
    };

    void loadRun();
  }, [params.id, router]);

  if (isLoading) {
    return <div className="py-12 text-center text-neutral-500">Загрузка...</div>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/admin/imports" className="inline-block text-[#1F3B73] hover:underline">
          ← Назад к импортам
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      </div>
    );
  }

  if (!run) {
    return null;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <Link href="/admin/imports" className="inline-block text-sm text-[#1F3B73] hover:underline">
            ← Назад к импортам
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[#1F3B73]">Run #{run.id}</h1>
        </div>
        {run.previous_successful_run && (
          <Link
            href={`/admin/imports/${run.previous_successful_run.id}`}
            className="rounded-xl border border-neutral-300 px-3 py-2 text-sm text-[#1F3B73] hover:bg-neutral-50"
          >
            Previous successful run #{run.previous_successful_run.id}
          </Link>
        )}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
          <p><span className="text-neutral-500">Статус:</span> {run.status}</p>
          <p><span className="text-neutral-500">Source:</span> {run.source || "—"}</p>
          <p><span className="text-neutral-500">Entity:</span> {run.entity_type}</p>
          <p>
            <span className="text-neutral-500">Created by:</span>{" "}
            {run.created_by_user || (run.created_by ? `#${run.created_by}` : "—")}
          </p>
          <p>
            <span className="text-neutral-500">Дата старта:</span>{" "}
            {run.started_at ? new Date(run.started_at).toLocaleString("ru-RU") : "—"}
          </p>
          <p>
            <span className="text-neutral-500">Дата завершения:</span>{" "}
            {run.finished_at ? new Date(run.finished_at).toLocaleString("ru-RU") : "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
          <p><span className="text-neutral-500">Total:</span> {run.total}</p>
          <p><span className="text-neutral-500">Created:</span> {run.created}</p>
          <p><span className="text-neutral-500">Updated:</span> {run.updated}</p>
          <p><span className="text-neutral-500">Failed:</span> {run.failed}</p>
          <p><span className="text-neutral-500">Errors count:</span> {run.errors.length}</p>
          <p><span className="text-neutral-500">Snapshot items:</span> {run.snapshot_metadata.items_count}</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-neutral-200 p-4">
        <h2 className="mb-3 text-lg font-semibold text-[#1F3B73]">Summary</h2>
        <pre className="overflow-x-auto rounded-xl bg-neutral-50 p-3 text-xs text-neutral-700">
          {JSON.stringify(run.summary, null, 2)}
        </pre>
      </div>

      <div className="mb-6 rounded-2xl border border-neutral-200 p-4">
        <h2 className="mb-3 text-lg font-semibold text-[#1F3B73]">Snapshot metadata</h2>
        <div className="space-y-1 text-sm text-neutral-700">
          <p>Has snapshot: {run.snapshot_metadata.has_snapshot ? "yes" : "no"}</p>
          <p>Items count: {run.snapshot_metadata.items_count}</p>
          <p>Sample keys: {run.snapshot_metadata.sample_keys.join(", ") || "—"}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-4">
        <h2 className="mb-3 text-lg font-semibold text-[#1F3B73]">Errors</h2>
        {run.errors.length === 0 ? (
          <p className="text-sm text-neutral-500">Ошибок нет</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {run.errors.map((item, index) => (
              <li key={`${index}-${item.slice(0, 30)}`}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
