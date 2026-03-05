'use client';

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";

type VinRequest = {
  id: number;
  uuid: string;
  status: "new" | "in_progress" | "closed";
  vin: string;
  name: string | null;
  phone: string;
  email: string | null;
  message: string | null;
  operator_comment: string | null;
  consent_given: boolean;
  consent_version: string | null;
  consent_text: string | null;
  consent_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = [
  { value: "new", label: "Новая" },
  { value: "in_progress", label: "В работе" },
  { value: "closed", label: "Закрыта" },
] as const;

export default function VinRequestDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params.id;

  const [request, setRequest] = useState<VinRequest | null>(null);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<VinRequest["status"]>("new");
  const [operatorComment, setOperatorComment] = useState("");

  const getStatusLabel = (statusValue: string) => {
    return STATUS_OPTIONS.find((option) => option.value === statusValue)?.label || statusValue;
  };

  const fetchStatuses = useCallback(async () => {
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) return;

      const apiBaseUrl = getClientApiBaseUrl();
      const response = await fetch(withApiBase(apiBaseUrl, "/api/admin/vin-requests/statuses"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const payload = (await response.json()) as string[];
        setStatuses(payload);
      }
    } catch (fetchError) {
      console.error(fetchError);
    }
  }, []);

  const fetchRequest = useCallback(async () => {
    setError("");

    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin/login");
        return;
      }

      const apiBaseUrl = getClientApiBaseUrl();
      const response = await fetch(withApiBase(apiBaseUrl, `/api/admin/vin-requests/${requestId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Не удалось загрузить VIN-заявку");
      }

      const payload = (await response.json()) as VinRequest;
      setRequest(payload);
      setSelectedStatus(payload.status);
      setOperatorComment(payload.operator_comment || "");
    } catch (fetchError) {
      console.error(fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "Ошибка загрузки VIN-заявки");
    } finally {
      setLoading(false);
    }
  }, [requestId, router]);

  useEffect(() => {
    void fetchStatuses();
  }, [fetchStatuses]);

  useEffect(() => {
    void fetchRequest();
  }, [fetchRequest]);

  async function handleSave() {
    if (!request) return;

    setSaving(true);
    setError("");
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin/login");
        return;
      }

      const apiBaseUrl = getClientApiBaseUrl();
      const response = await fetch(withApiBase(apiBaseUrl, `/api/admin/vin-requests/${request.id}/status`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: selectedStatus,
          operator_comment: operatorComment.trim() || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail || "Не удалось обновить VIN-заявку");
      }

      const updated = (await response.json()) as VinRequest;
      setRequest(updated);
      setSelectedStatus(updated.status);
      setOperatorComment(updated.operator_comment || "");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[#1F3B73]">Загрузка...</div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <p className="text-neutral-600">VIN-заявка не найдена</p>
        <Link href="/admin/vin-requests" className="mt-3 inline-block text-[#1F3B73] hover:underline">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/vin-requests" className="text-sm text-[#1F3B73] hover:underline">
          ← Назад к списку
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[#1F3B73]">VIN-заявка #{request.id}</h1>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#1F3B73]">Данные заявки</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-neutral-500">UUID</dt><dd className="font-mono">{request.uuid}</dd></div>
            <div><dt className="text-neutral-500">Статус</dt><dd>{getStatusLabel(request.status)}</dd></div>
            <div><dt className="text-neutral-500">VIN</dt><dd className="font-mono">{request.vin}</dd></div>
            <div><dt className="text-neutral-500">Имя</dt><dd>{request.name || "—"}</dd></div>
            <div><dt className="text-neutral-500">Телефон</dt><dd>{request.phone}</dd></div>
            <div><dt className="text-neutral-500">Email</dt><dd>{request.email || "—"}</dd></div>
            <div><dt className="text-neutral-500">Сообщение</dt><dd className="whitespace-pre-wrap">{request.message || "—"}</dd></div>
            <div><dt className="text-neutral-500">Дата создания</dt><dd>{new Date(request.created_at).toLocaleString("ru-RU")}</dd></div>
            <div><dt className="text-neutral-500">Дата обновления</dt><dd>{new Date(request.updated_at).toLocaleString("ru-RU")}</dd></div>
            <div><dt className="text-neutral-500">Согласие 152-ФЗ</dt><dd>{request.consent_given ? "Да" : "Нет"}</dd></div>
            <div><dt className="text-neutral-500">Версия согласия</dt><dd>{request.consent_version || "—"}</dd></div>
            <div><dt className="text-neutral-500">Дата согласия</dt><dd>{request.consent_at ? new Date(request.consent_at).toLocaleString("ru-RU") : "—"}</dd></div>
            <div><dt className="text-neutral-500">Текст согласия</dt><dd className="whitespace-pre-wrap">{request.consent_text || "—"}</dd></div>
            <div><dt className="text-neutral-500">IP</dt><dd>{request.ip_address || "—"}</dd></div>
            <div><dt className="text-neutral-500">User-Agent</dt><dd className="break-all">{request.user_agent || "—"}</dd></div>
          </dl>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#1F3B73]">Обработка</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Статус</label>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as VinRequest["status"])}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
              >
                {(statuses.length > 0 ? statuses : STATUS_OPTIONS.map((option) => option.value)).map((statusValue) => (
                  <option key={statusValue} value={statusValue}>
                    {getStatusLabel(statusValue)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Комментарий оператора</label>
              <textarea
                rows={6}
                value={operatorComment}
                onChange={(event) => setOperatorComment(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl bg-[#FF7A00] px-4 py-2 text-sm font-medium text-white hover:bg-[#e66e00] disabled:opacity-60"
            >
              {saving ? "Сохранение..." : "Сохранить изменения"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
