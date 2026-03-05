'use client';

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";

type ServiceRequest = {
  id: number;
  uuid: string;
  status: string;
  vehicle_type: string;
  service_type: string;
  name: string;
  phone: string;
  email: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vin: string | null;
  mileage: number | null;
  description: string | null;
  preferred_date: string | null;
  consent_given: boolean;
  created_at: string;
};

export default function AdminServiceRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const fetchServiceRequests = useCallback(async () => {
    setError("");

    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin/login");
        return;
      }

      const apiBaseUrl = getClientApiBaseUrl();
      const query = new URLSearchParams({ limit: "100" });
      if (status) query.set("status", status);
      if (search.trim()) query.set("search", search.trim());

      const res = await fetch(withApiBase(apiBaseUrl, `/api/admin/service-requests?${query.toString()}`), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to fetch service requests");
      }

      const data = (await res.json()) as ServiceRequest[];
      setRequests(data);
    } catch (fetchError) {
      console.error(fetchError);
      setError("Ошибка загрузки заявок сервиса");
    } finally {
      setLoading(false);
    }
  }, [router, search, status]);

  useEffect(() => {
    void fetchServiceRequests();
  }, [fetchServiceRequests]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[#1F3B73]">Загрузка...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[#1F3B73]">Заявки на сервис</h1>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">Статус</label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          >
            <option value="">Все</option>
            <option value="new">Новая</option>
            <option value="in_progress">В работе</option>
            <option value="closed">Закрыта</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">Поиск</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Имя или телефон"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          />
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white py-12 text-center text-neutral-500">
          <p>Заявок пока нет</p>
          <p className="mt-2 text-sm">Заявки появятся здесь после отправки формы на сайте</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Тип авто</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Услуга</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-neutral-600">Статус</th>
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
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        request.vehicle_type === "truck"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {request.vehicle_type === "truck" ? "Грузовой" : "Легковой"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{request.service_type}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                      {request.status === "new" ? "Новая" : request.status === "in_progress" ? "В работе" : "Закрыта"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{request.phone}</td>
                  <td className="px-4 py-3 text-sm">{request.name}</td>
                  <td className="px-4 py-3 text-sm">{request.consent_given ? "Да" : "Нет"}</td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(request.created_at).toLocaleString("ru-RU")}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <a className="text-[#1F3B73] hover:underline" href={`/admin/service-requests/${request.id}`}>
                      Открыть
                    </a>
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
