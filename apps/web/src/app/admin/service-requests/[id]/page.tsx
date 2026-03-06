'use client';

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type ServiceRequest = {
  id: number;
  uuid: string;
  status: "new" | "in_progress" | "closed";
  vehicle_type: "passenger" | "truck";
  service_type: string;
  name: string;
  phone: string;
  email: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vin: string | null;
  mileage: number | null;
  description: string;
  operator_comment: string | null;
  preferred_date: string | null;
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

export default function ServiceRequestDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params.id;

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<ServiceRequest["status"]>("new");
  const [operatorComment, setOperatorComment] = useState("");

  const fetchRequest = useCallback(async () => {
    setError("");

    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin/login");
        return;
      }

      const apiBaseUrl = getClientApiBaseUrl();
      const payload = await fetchJsonWithTimeout<ServiceRequest>(
        withApiBase(apiBaseUrl, `/api/admin/service-requests/${requestId}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        12000
      );
      setRequest(payload);
      setSelectedStatus(payload.status);
      setOperatorComment(payload.operator_comment || "");
    } catch (fetchError) {
      if (fetchError instanceof ApiRequestError && (fetchError.status === 401 || fetchError.status === 403)) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }
      if (fetchError instanceof ApiRequestError) {
        setError(fetchError.traceId ? `${fetchError.message}. Код: ${fetchError.traceId}` : fetchError.message);
      } else {
        setError("Ошибка загрузки заявки");
      }
    } finally {
      setLoading(false);
    }
  }, [requestId, router]);

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
      const updated = await fetchJsonWithTimeout<ServiceRequest>(
        withApiBase(apiBaseUrl, `/api/admin/service-requests/${request.id}/status`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: selectedStatus,
            operator_comment: operatorComment.trim() || null,
          }),
        },
        12000
      );
      setRequest(updated);
      setSelectedStatus(updated.status);
      setOperatorComment(updated.operator_comment || "");
    } catch (saveError) {
      if (saveError instanceof ApiRequestError && (saveError.status === 401 || saveError.status === 403)) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }
      if (saveError instanceof ApiRequestError) {
        setError(saveError.traceId ? `${saveError.message}. Код: ${saveError.traceId}` : saveError.message);
      } else {
        setError("Ошибка сохранения");
      }
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
        <p className="text-neutral-600">Заявка не найдена</p>
        <Link href="/admin/service-requests" className="mt-3 inline-block text-[#1F3B73] hover:underline">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <Link href="/admin/service-requests" className="text-sm text-[#1F3B73] hover:underline">
            ← Назад к списку
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[#1F3B73]">Заявка сервиса #{request.id}</h1>
        </div>
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
            <div><dt className="text-neutral-500">UUID</dt><dd className="break-all font-mono text-xs sm:text-sm">{request.uuid}</dd></div>
            <div><dt className="text-neutral-500">Имя</dt><dd>{request.name}</dd></div>
            <div><dt className="text-neutral-500">Телефон</dt><dd>{request.phone}</dd></div>
            <div><dt className="text-neutral-500">Email</dt><dd>{request.email || "—"}</dd></div>
            <div><dt className="text-neutral-500">Тип техники</dt><dd>{request.vehicle_type === "truck" ? "Грузовая" : "Легковая"}</dd></div>
            <div><dt className="text-neutral-500">Тип услуги</dt><dd>{request.service_type}</dd></div>
            <div><dt className="text-neutral-500">Описание</dt><dd className="whitespace-pre-wrap">{request.description}</dd></div>
            <div><dt className="text-neutral-500">Автомобиль</dt><dd>{[request.vehicle_make, request.vehicle_model, request.vehicle_year].filter(Boolean).join(" ") || "—"}</dd></div>
            <div><dt className="text-neutral-500">VIN</dt><dd>{request.vin || "—"}</dd></div>
            <div><dt className="text-neutral-500">Пробег</dt><dd>{request.mileage || "—"}</dd></div>
            <div><dt className="text-neutral-500">Желаемая дата</dt><dd>{request.preferred_date ? new Date(request.preferred_date).toLocaleDateString("ru-RU") : "—"}</dd></div>
            <div><dt className="text-neutral-500">Дата создания</dt><dd>{new Date(request.created_at).toLocaleString("ru-RU")}</dd></div>
            <div><dt className="text-neutral-500">Дата обновления</dt><dd>{new Date(request.updated_at).toLocaleString("ru-RU")}</dd></div>
            <div><dt className="text-neutral-500">Согласие 152-ФЗ</dt><dd>{request.consent_given ? "Да" : "Нет"}</dd></div>
            <div><dt className="text-neutral-500">Версия согласия</dt><dd>{request.consent_version || "—"}</dd></div>
            <div><dt className="text-neutral-500">Дата согласия</dt><dd>{request.consent_at ? new Date(request.consent_at).toLocaleString("ru-RU") : "—"}</dd></div>
            <div><dt className="text-neutral-500">Текст согласия</dt><dd className="whitespace-pre-wrap break-words">{request.consent_text || "—"}</dd></div>
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
                onChange={(event) => setSelectedStatus(event.target.value as ServiceRequest["status"])}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
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
