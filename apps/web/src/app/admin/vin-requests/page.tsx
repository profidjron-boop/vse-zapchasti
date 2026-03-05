'use client';

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  consent_given: boolean;
  created_at: string;
};

const STATUS_LABELS: Record<VinRequest["status"], string> = {
  new: "Новая",
  in_progress: "В работе",
  closed: "Закрыта",
};

export default function AdminVinRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<VinRequest[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStatuses = useCallback(async () => {
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) return;

      const apiBaseUrl = getClientApiBaseUrl();
      const res = await fetch(withApiBase(apiBaseUrl, "/api/admin/vin-requests/statuses"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as string[];
        setStatuses(data);
      }
    } catch (fetchError) {
      console.error(fetchError);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin/login");
        return;
      }

      const query = new URLSearchParams({ limit: "100" });
      if (status) query.set("status", status);
      if (search.trim()) query.set("search", search.trim());

      const apiBaseUrl = getClientApiBaseUrl();
      const res = await fetch(withApiBase(apiBaseUrl, `/api/admin/vin-requests?${query.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }
      if (!res.ok) {
        throw new Error("Ошибка загрузки VIN-заявок");
      }

      const data = (await res.json()) as VinRequest[];
      setRequests(data);
    } catch (fetchError) {
      console.error(fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "Ошибка загрузки VIN-заявок");
    } finally {
      setLoading(false);
    }
  }, [router, search, status]);

  useEffect(() => {
    void fetchStatuses();
  }, [fetchStatuses]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[#1F3B73]">Загрузка...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1F3B73]">VIN-заявки</h1>
      </div>

      <div className="mb-6 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">Статус</label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          >
            <option value="">Все</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value as VinRequest["status"]] || value}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">Поиск</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="VIN, телефон, имя, email"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white py-12 text-center text-neutral-500">
          <p>VIN-заявок пока нет</p>
          <p className="mt-2 text-sm">Они появятся после отправки формы на странице /parts/vin</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Статус</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">VIN</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Телефон</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Имя</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Согласие</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Дата</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Карточка</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm">#{request.id}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                      {STATUS_LABELS[request.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">{request.vin}</td>
                  <td className="px-4 py-3 text-sm">{request.phone}</td>
                  <td className="px-4 py-3 text-sm">{request.name || "—"}</td>
                  <td className="px-4 py-3 text-sm">{request.consent_given ? "Да" : "Нет"}</td>
                  <td className="px-4 py-3 text-sm">{new Date(request.created_at).toLocaleString("ru-RU")}</td>
                  <td className="px-4 py-3 text-sm">
                    <Link className="text-[#1F3B73] hover:underline" href={`/admin/vin-requests/${request.id}`}>
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
