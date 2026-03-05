'use client';

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";

type VehicleType = "passenger" | "truck" | "both";

type ServiceCatalogItem = {
  id: number;
  name: string;
  vehicle_type: VehicleType;
  duration_minutes: number | null;
  price: number | null;
  sort_order: number;
  is_active: boolean;
};

type ServiceCatalogDraft = {
  name: string;
  vehicle_type: VehicleType;
  duration_minutes: string;
  price: string;
  sort_order: string;
  is_active: boolean;
};

function toDraft(item: ServiceCatalogItem): ServiceCatalogDraft {
  return {
    name: item.name,
    vehicle_type: item.vehicle_type,
    duration_minutes: item.duration_minutes !== null ? String(item.duration_minutes) : "",
    price: item.price !== null ? String(item.price) : "",
    sort_order: String(item.sort_order),
    is_active: item.is_active,
  };
}

export default function AdminServiceCatalogPage() {
  const router = useRouter();
  const [items, setItems] = useState<ServiceCatalogItem[]>([]);
  const [drafts, setDrafts] = useState<Record<number, ServiceCatalogDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchCatalog = useCallback(async (showRefreshing = false) => {
    setError("");
    if (showRefreshing) setIsRefreshing(true);

    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin/login");
        return;
      }

      const apiBaseUrl = getClientApiBaseUrl();
      const response = await fetch(withApiBase(apiBaseUrl, "/api/admin/service-catalog?include_inactive=true"), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }
      if (!response.ok) throw new Error("Не удалось загрузить справочник услуг");

      const payload = (await response.json()) as ServiceCatalogItem[];
      setItems(payload);
      setDrafts(
        Object.fromEntries(
          payload.map((item) => [item.id, toDraft(item)])
        )
      );
    } catch (fetchError) {
      console.error(fetchError);
      setError("Не удалось загрузить справочник услуг");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  function updateDraft(id: number, key: keyof ServiceCatalogDraft, value: string | boolean) {
    setDrafts((current) => {
      const existing = current[id];
      if (!existing) return current;
      return {
        ...current,
        [id]: {
          ...existing,
          [key]: value,
        },
      };
    });
  }

  async function handleSave(id: number) {
    const draft = drafts[id];
    if (!draft) return;

    setError("");
    setSuccess("");
    setSavingId(id);
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin/login");
        return;
      }

      const apiBaseUrl = getClientApiBaseUrl();
      const response = await fetch(withApiBase(apiBaseUrl, `/api/admin/service-catalog/${id}`), {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: draft.name.trim(),
          vehicle_type: draft.vehicle_type,
          duration_minutes: draft.duration_minutes ? Number(draft.duration_minutes) : null,
          price: draft.price ? Number(draft.price) : null,
          sort_order: Number(draft.sort_order || 0),
          is_active: draft.is_active,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail || "Не удалось сохранить услугу");
      }

      setSuccess(`Услуга #${id} сохранена`);
      await fetchCatalog();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить услугу");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeactivate(id: number) {
    setError("");
    setSuccess("");
    setDeletingId(id);
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin/login");
        return;
      }

      const apiBaseUrl = getClientApiBaseUrl();
      const response = await fetch(withApiBase(apiBaseUrl, `/api/admin/service-catalog/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail || "Не удалось деактивировать услугу");
      }

      setSuccess(`Услуга #${id} деактивирована`);
      await fetchCatalog();
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось деактивировать услугу");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;

    setError("");
    setSuccess("");
    setIsCreating(true);
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) {
        router.push("/admin/login");
        return;
      }

      const formData = new FormData(event.currentTarget);
      const payload = {
        name: String(formData.get("name") || "").trim(),
        vehicle_type: String(formData.get("vehicle_type") || "passenger"),
        duration_minutes: formData.get("duration_minutes") ? Number(formData.get("duration_minutes")) : null,
        price: formData.get("price") ? Number(formData.get("price")) : null,
        sort_order: Number(formData.get("sort_order") || 0),
        is_active: formData.get("is_active") === "on",
      };

      const apiBaseUrl = getClientApiBaseUrl();
      const response = await fetch(withApiBase(apiBaseUrl, "/api/admin/service-catalog"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail || "Не удалось создать услугу");
      }

      event.currentTarget.reset();
      setSuccess("Услуга добавлена");
      await fetchCatalog();
    } catch (createError) {
      console.error(createError);
      setError(createError instanceof Error ? createError.message : "Не удалось создать услугу");
    } finally {
      setIsCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[#1F3B73]">Загрузка...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[#1F3B73]">Справочник услуг</h1>
        <button
          type="button"
          onClick={() => void fetchCatalog(true)}
          disabled={isRefreshing}
          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          {isRefreshing ? "Обновление..." : "Обновить"}
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</div>
      ) : null}

      <form onSubmit={handleCreate} className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-[#1F3B73]">Новая услуга</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            name="name"
            required
            placeholder="Название услуги"
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          />
          <select
            name="vehicle_type"
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
            defaultValue="passenger"
          >
            <option value="passenger">Легковые</option>
            <option value="truck">Грузовые</option>
            <option value="both">Оба типа</option>
          </select>
          <input
            type="number"
            name="duration_minutes"
            min={1}
            placeholder="Длительность, минут"
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          />
          <input
            type="number"
            name="price"
            min={0}
            step="0.01"
            placeholder="Цена, ₽"
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          />
          <input
            type="number"
            name="sort_order"
            defaultValue={0}
            placeholder="Сортировка"
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          />
          <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            <input type="checkbox" name="is_active" defaultChecked />
            Активна
          </label>
        </div>
        <button
          type="submit"
          disabled={isCreating}
          className="mt-3 rounded-xl bg-[#FF7A00] px-4 py-2 text-sm font-medium text-white hover:bg-[#e66e00] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCreating ? "Добавление..." : "Добавить"}
        </button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">
          Услуг пока нет
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[980px]">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Название</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Тип</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Минут</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Цена</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Сорт.</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Активна</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {items.map((item) => {
                const draft = drafts[item.id] ?? toDraft(item);
                return (
                  <tr key={item.id} className="align-top">
                    <td className="px-3 py-2 text-sm text-neutral-600">{item.id}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(event) => updateDraft(item.id, "name", event.target.value)}
                        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={draft.vehicle_type}
                        onChange={(event) => updateDraft(item.id, "vehicle_type", event.target.value as VehicleType)}
                        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm"
                      >
                        <option value="passenger">Легковые</option>
                        <option value="truck">Грузовые</option>
                        <option value="both">Оба типа</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        value={draft.duration_minutes}
                        onChange={(event) => updateDraft(item.id, "duration_minutes", event.target.value)}
                        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.price}
                        onChange={(event) => updateDraft(item.id, "price", event.target.value)}
                        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={draft.sort_order}
                        onChange={(event) => updateDraft(item.id, "sort_order", event.target.value)}
                        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={draft.is_active}
                          onChange={(event) => updateDraft(item.id, "is_active", event.target.checked)}
                        />
                        {draft.is_active ? "Да" : "Нет"}
                      </label>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSave(item.id)}
                          disabled={savingId === item.id}
                          className="rounded-lg border border-[#1F3B73]/20 bg-white px-2 py-1 text-xs font-medium text-[#1F3B73] hover:bg-[#1F3B73]/5 disabled:opacity-60"
                        >
                          {savingId === item.id ? "Сохранение..." : "Сохранить"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeactivate(item.id)}
                          disabled={deletingId === item.id}
                          className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          {deletingId === item.id ? "..." : "Деактивировать"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

