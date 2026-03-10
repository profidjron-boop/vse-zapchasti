"use client";

import {
  type ChangeEvent,
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import {
  redirectIfAdminUnauthorized,
  toAdminErrorMessage,
} from "@/components/admin/api-error";
import { fetchJsonWithTimeout } from "@/lib/fetch-json";
import { AdminTotalPagesFooter } from "@/components/admin/table-pagination-shared";

type VehicleType = "passenger" | "truck" | "both";

type ServiceCatalogItem = {
  id: number;
  name: string;
  vehicle_type: VehicleType;
  duration_minutes: number | null;
  price: number | null;
  prepayment_required: boolean;
  prepayment_amount: number | null;
  sort_order: number;
  is_active: boolean;
};

type ServiceCatalogDraft = {
  name: string;
  vehicle_type: VehicleType;
  duration_minutes: string;
  price: string;
  prepayment_required: boolean;
  prepayment_amount: string;
  sort_order: string;
  is_active: boolean;
};

function toDraft(item: ServiceCatalogItem): ServiceCatalogDraft {
  return {
    name: item.name,
    vehicle_type: item.vehicle_type,
    duration_minutes:
      item.duration_minutes !== null ? String(item.duration_minutes) : "",
    price: item.price !== null ? String(item.price) : "",
    prepayment_required: item.prepayment_required,
    prepayment_amount:
      item.prepayment_amount !== null ? String(item.prepayment_amount) : "",
    sort_order: String(item.sort_order),
    is_active: item.is_active,
  };
}

const PAGE_SIZE = 25;
const VEHICLE_TYPE_OPTIONS: Array<{ value: VehicleType; label: string }> = [
  { value: "passenger", label: "Легковые" },
  { value: "truck", label: "Грузовые" },
  { value: "both", label: "Оба типа" },
];
const MOBILE_INPUT_CLASS =
  "w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm";
const DESKTOP_INPUT_CLASS =
  "w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm";
const MOBILE_CHECKBOX_LABEL_CLASS =
  "flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700";
const DESKTOP_CHECKBOX_LABEL_CLASS =
  "flex items-center gap-2 text-sm text-neutral-700";

type BindDraftFieldHandler = (
  id: number,
  key: keyof ServiceCatalogDraft,
) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
type DraftRenderMode = "mobile" | "desktop";

type ServiceCatalogDraftControls = {
  nameInput: ReactNode;
  vehicleTypeSelect: ReactNode;
  durationInput: ReactNode;
  priceInput: ReactNode;
  prepaymentToggle: ReactNode;
  prepaymentAmountInput: ReactNode;
  sortOrderInput: ReactNode;
  activeToggle: ReactNode;
};

type ServiceCatalogDraftControlsOptions = {
  itemId: number;
  draft: ServiceCatalogDraft;
  mode: DraftRenderMode;
  bindDraftField: BindDraftFieldHandler;
};

function createServiceCatalogDraftControls({
  itemId,
  draft,
  mode,
  bindDraftField,
}: ServiceCatalogDraftControlsOptions): ServiceCatalogDraftControls {
  const inputClass = mode === "mobile" ? MOBILE_INPUT_CLASS : DESKTOP_INPUT_CLASS;
  const checkboxLabelClass =
    mode === "mobile" ? MOBILE_CHECKBOX_LABEL_CLASS : DESKTOP_CHECKBOX_LABEL_CLASS;
  const prepaymentText =
    mode === "mobile"
      ? "Нужна предоплата"
      : draft.prepayment_required
        ? "Да"
        : "Нет";
  const activeText = mode === "mobile" ? "Активна" : draft.is_active ? "Да" : "Нет";

  return {
    nameInput: (
      <input
        type="text"
        value={draft.name}
        onChange={bindDraftField(itemId, "name")}
        className={inputClass}
      />
    ),
    vehicleTypeSelect: (
      <select
        value={draft.vehicle_type}
        onChange={bindDraftField(itemId, "vehicle_type")}
        className={inputClass}
      >
        {VEHICLE_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
    durationInput: (
      <input
        type="number"
        min={1}
        value={draft.duration_minutes}
        onChange={bindDraftField(itemId, "duration_minutes")}
        className={inputClass}
      />
    ),
    priceInput: (
      <input
        type="number"
        min={0}
        step="0.01"
        value={draft.price}
        onChange={bindDraftField(itemId, "price")}
        className={inputClass}
      />
    ),
    prepaymentToggle: (
      <label className={checkboxLabelClass}>
        <input
          type="checkbox"
          checked={draft.prepayment_required}
          onChange={bindDraftField(itemId, "prepayment_required")}
        />
        {prepaymentText}
      </label>
    ),
    prepaymentAmountInput: (
      <input
        type="number"
        min={0}
        step="0.01"
        value={draft.prepayment_amount}
        onChange={bindDraftField(itemId, "prepayment_amount")}
        disabled={!draft.prepayment_required}
        className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
      />
    ),
    sortOrderInput: (
      <input
        type="number"
        value={draft.sort_order}
        onChange={bindDraftField(itemId, "sort_order")}
        className={inputClass}
      />
    ),
    activeToggle: (
      <label className={checkboxLabelClass}>
        <input
          type="checkbox"
          checked={draft.is_active}
          onChange={bindDraftField(itemId, "is_active")}
        />
        {activeText}
      </label>
    ),
  };
}

type ServiceCatalogActionButtonsOptions = {
  itemId: number;
  mode: DraftRenderMode;
  savingId: number | null;
  deletingId: number | null;
  onSave: (id: number) => Promise<void>;
  onDeactivate: (id: number) => Promise<void>;
};

function renderServiceCatalogActionButtons({
  itemId,
  mode,
  savingId,
  deletingId,
  onSave,
  onDeactivate,
}: ServiceCatalogActionButtonsOptions): ReactNode {
  const isMobile = mode === "mobile";
  const containerClass = isMobile ? "mt-3 flex flex-col gap-2" : "flex flex-wrap gap-2";
  const saveClass = isMobile
    ? "w-full rounded-lg border border-[#1F3B73]/20 bg-white px-3 py-2 text-sm font-medium text-[#1F3B73] hover:bg-[#1F3B73]/5 disabled:opacity-60"
    : "rounded-lg border border-[#1F3B73]/20 bg-white px-2 py-1 text-xs font-medium text-[#1F3B73] hover:bg-[#1F3B73]/5 disabled:opacity-60";
  const deactivateClass = isMobile
    ? "w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
    : "rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60";

  return (
    <div className={containerClass}>
      <button
        type="button"
        onClick={() => void onSave(itemId)}
        disabled={savingId === itemId}
        className={saveClass}
      >
        {savingId === itemId ? "Сохранение..." : "Сохранить"}
      </button>
      <button
        type="button"
        onClick={() => void onDeactivate(itemId)}
        disabled={deletingId === itemId}
        className={deactivateClass}
      >
        {deletingId === itemId ? "..." : "Деактивировать"}
      </button>
    </div>
  );
}

export default function AdminServiceCatalogPage() {
  const router = useRouter();
  const [items, setItems] = useState<ServiceCatalogItem[]>([]);
  const [drafts, setDrafts] = useState<Record<number, ServiceCatalogDraft>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchCatalog = useCallback(
    async (showRefreshing = false) => {
      setError("");
      if (showRefreshing) setIsRefreshing(true);

      try {
        const apiBaseUrl = getClientApiBaseUrl();
        const payload = await fetchJsonWithTimeout<ServiceCatalogItem[]>(
          withApiBase(
            apiBaseUrl,
            "/api/admin/service-catalog?include_inactive=true",
          ),
          {},
          12000,
        );
        setItems(payload);
        setDrafts(
          Object.fromEntries(payload.map((item) => [item.id, toDraft(item)])),
        );
      } catch (fetchError) {
        if (redirectIfAdminUnauthorized(fetchError, router)) {
          return;
        }
        setError(
          toAdminErrorMessage(fetchError, "Не удалось загрузить справочник услуг"),
        );
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return items;
    return items.filter((item) =>
      `${item.name} ${item.vehicle_type}`
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [items, search]);

  const totalPages = useMemo(() => {
    if (filteredItems.length <= 0) return 1;
    return Math.ceil(filteredItems.length / PAGE_SIZE);
  }, [filteredItems.length]);

  const pagedItems = useMemo(() => {
    const offset = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(offset, offset + PAGE_SIZE);
  }, [filteredItems, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  function handlePageJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number.parseInt(pageInput, 10);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(page));
      return;
    }
    const nextPage = Math.max(1, Math.min(totalPages, parsed));
    setPage(nextPage);
    setPageInput(String(nextPage));
  }

  function updateDraft(
    id: number,
    key: keyof ServiceCatalogDraft,
    value: string | boolean,
  ) {
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

  function bindDraftField(id: number, key: keyof ServiceCatalogDraft) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const nextValue =
        event.target instanceof HTMLInputElement &&
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value;
      updateDraft(id, key, nextValue);
    };
  }

  async function handleSave(id: number) {
    const draft = drafts[id];
    if (!draft) return;

    setError("");
    setSuccess("");
    setSavingId(id);
    try {
      const apiBaseUrl = getClientApiBaseUrl();
      await fetchJsonWithTimeout<{ id: number }>(
        withApiBase(apiBaseUrl, `/api/admin/service-catalog/${id}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: draft.name.trim(),
            vehicle_type: draft.vehicle_type,
            duration_minutes: draft.duration_minutes
              ? Number(draft.duration_minutes)
              : null,
            price: draft.price ? Number(draft.price) : null,
            prepayment_required: draft.prepayment_required,
            prepayment_amount:
              draft.prepayment_required && draft.prepayment_amount
                ? Number(draft.prepayment_amount)
                : null,
            sort_order: Number(draft.sort_order || 0),
            is_active: draft.is_active,
          }),
        },
        12000,
      );

      setSuccess(`Услуга #${id} сохранена`);
      await fetchCatalog();
    } catch (saveError) {
      if (redirectIfAdminUnauthorized(saveError, router)) {
        return;
      }
      setError(toAdminErrorMessage(saveError, "Не удалось сохранить услугу"));
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeactivate(id: number) {
    setError("");
    setSuccess("");
    setDeletingId(id);
    try {
      const apiBaseUrl = getClientApiBaseUrl();
      await fetchJsonWithTimeout<{ id: number }>(
        withApiBase(apiBaseUrl, `/api/admin/service-catalog/${id}`),
        {
          method: "DELETE",
        },
        12000,
      );

      setSuccess(`Услуга #${id} деактивирована`);
      await fetchCatalog();
    } catch (deleteError) {
      if (redirectIfAdminUnauthorized(deleteError, router)) {
        return;
      }
      setError(toAdminErrorMessage(deleteError, "Не удалось деактивировать услугу"));
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
      const formData = new FormData(event.currentTarget);
      const payload = {
        name: String(formData.get("name") || "").trim(),
        vehicle_type: String(formData.get("vehicle_type") || "passenger"),
        duration_minutes: formData.get("duration_minutes")
          ? Number(formData.get("duration_minutes"))
          : null,
        price: formData.get("price") ? Number(formData.get("price")) : null,
        prepayment_required: formData.get("prepayment_required") === "on",
        prepayment_amount:
          formData.get("prepayment_required") === "on" &&
          formData.get("prepayment_amount")
            ? Number(formData.get("prepayment_amount"))
            : null,
        sort_order: Number(formData.get("sort_order") || 0),
        is_active: formData.get("is_active") === "on",
      };

      const apiBaseUrl = getClientApiBaseUrl();
      await fetchJsonWithTimeout<{ id: number }>(
        withApiBase(apiBaseUrl, "/api/admin/service-catalog"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        12000,
      );

      event.currentTarget.reset();
      setSuccess("Услуга добавлена");
      await fetchCatalog();
    } catch (createError) {
      if (redirectIfAdminUnauthorized(createError, router)) {
        return;
      }
      setError(toAdminErrorMessage(createError, "Не удалось создать услугу"));
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

      <div className="mb-4 min-h-[4.5rem]">
        {error ? (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}
        {!error && success ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
          >
            {success}
          </div>
        ) : null}
      </div>

      <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
          Поиск услуги
        </label>
        <input
          type="text"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Название или тип (легковые/грузовые)"
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
        />
      </div>

      <form
        onSubmit={handleCreate}
        className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4"
      >
        <h2 className="mb-3 text-sm font-semibold text-[#1F3B73]">
          Новая услуга
        </h2>
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
          <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            <input type="checkbox" name="prepayment_required" />
            Нужна предоплата
          </label>
          <input
            type="number"
            name="prepayment_amount"
            min={0}
            step="0.01"
            placeholder="Сумма предоплаты, ₽"
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

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-500">
          {items.length === 0
            ? "Услуг пока нет"
            : "По выбранному фильтру услуги не найдены"}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-neutral-500">
            Показано: {pagedItems.length} из {filteredItems.length} · Страница{" "}
            {page} из {totalPages}
          </div>
          <div className="space-y-3 md:hidden">
            {pagedItems.map((item) => {
              const draft = drafts[item.id] ?? toDraft(item);
              const controls = createServiceCatalogDraftControls({
                itemId: item.id,
                draft,
                mode: "mobile",
                bindDraftField,
              });

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#1F3B73]">
                      Услуга #{item.id}
                    </span>
                    <span className="text-xs text-neutral-600">
                      {draft.is_active ? "Активна" : "Неактивна"}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                        Название
                      </label>
                      {controls.nameInput}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                        Тип
                      </label>
                      {controls.vehicleTypeSelect}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                          Минут
                        </label>
                        {controls.durationInput}
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                          Цена
                        </label>
                        {controls.priceInput}
                      </div>
                    </div>

                    {controls.prepaymentToggle}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                          Сумма
                        </label>
                        {controls.prepaymentAmountInput}
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                          Сорт.
                        </label>
                        {controls.sortOrderInput}
                      </div>
                    </div>

                    {controls.activeToggle}
                  </div>

                  {renderServiceCatalogActionButtons({
                    itemId: item.id,
                    mode: "mobile",
                    savingId,
                    deletingId,
                    onSave: handleSave,
                    onDeactivate: handleDeactivate,
                  })}
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-neutral-200 bg-white md:block">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    ID
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Название
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Тип
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Минут
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Цена
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Предоплата
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Сумма
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Сорт.
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Активна
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {pagedItems.map((item) => {
                  const draft = drafts[item.id] ?? toDraft(item);
                  const controls = createServiceCatalogDraftControls({
                    itemId: item.id,
                    draft,
                    mode: "desktop",
                    bindDraftField,
                  });

                  return (
                    <tr key={item.id} className="align-top">
                      <td className="px-3 py-2 text-sm text-neutral-600">
                        {item.id}
                      </td>
                      <td className="px-3 py-2">{controls.nameInput}</td>
                      <td className="px-3 py-2">{controls.vehicleTypeSelect}</td>
                      <td className="px-3 py-2">{controls.durationInput}</td>
                      <td className="px-3 py-2">{controls.priceInput}</td>
                      <td className="px-3 py-2">{controls.prepaymentToggle}</td>
                      <td className="px-3 py-2">{controls.prepaymentAmountInput}</td>
                      <td className="px-3 py-2">{controls.sortOrderInput}</td>
                      <td className="px-3 py-2">{controls.activeToggle}</td>
                      <td className="px-3 py-2">
                        {renderServiceCatalogActionButtons({
                          itemId: item.id,
                          mode: "desktop",
                          savingId,
                          deletingId,
                          onSave: handleSave,
                          onDeactivate: handleDeactivate,
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <AdminTotalPagesFooter
            summary="Поиск выполняется по всему справочнику услуг."
            page={page}
            totalPages={totalPages}
            pageInput={pageInput}
            jumpInputId="service-catalog-page-jump"
            onPageInputChange={setPageInput}
            onPrevPage={() => setPage((prev) => Math.max(1, prev - 1))}
            onNextPage={() =>
              setPage((prev) => Math.min(totalPages, prev + 1))
            }
            onJumpToPage={handlePageJump}
            containerClassName="px-1 pt-3"
          />
        </div>
      )}
    </div>
  );
}
