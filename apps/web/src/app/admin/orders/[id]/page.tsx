'use client';

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type OrderItem = {
  id: number;
  product_id: number | null;
  product_sku: string | null;
  product_name: string;
  quantity: number;
  unit_price: number | null;
  line_total: number | null;
};

type OrderDetails = {
  id: number;
  uuid: string;
  status: string;
  source: string;
  customer_name: string | null;
  customer_phone: string;
  customer_email: string | null;
  comment: string | null;
  delivery_method: string | null;
  payment_method: string | null;
  legal_entity_name: string | null;
  legal_entity_inn: string | null;
  invoice_requisites_file_url: string | null;
  invoice_requisites_file_name: string | null;
  manager_comment: string | null;
  consent_given: boolean;
  consent_version: string | null;
  consent_text: string | null;
  consent_at: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
};

function statusLabel(value: string): string {
  if (value === "new") return "Новый";
  if (value === "in_progress") return "В работе";
  if (value === "ready") return "Готов";
  if (value === "closed") return "Закрыт";
  if (value === "canceled") return "Отменён";
  return value;
}

function sourceLabel(value: string): string {
  if (value === "checkout") return "Оформление";
  if (value === "one_click") return "Быстрый заказ";
  return value;
}

function formatPrice(value: number | null): string {
  return typeof value === "number" ? `${Math.round(value).toLocaleString("ru-RU")} ₽` : "Цена по запросу";
}

export default function AdminOrderDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [managerComment, setManagerComment] = useState("");

  const fetchStatuses = useCallback(async () => {
    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const payload = await fetchJsonWithTimeout<string[]>(
        withApiBase(apiBaseUrl, "/api/admin/orders/statuses"),
        {},
        12000
      );
      if (Array.isArray(payload)) {
        setStatuses(payload);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchOrder = useCallback(async () => {
    setError("");
    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const payload = await fetchJsonWithTimeout<OrderDetails>(
        withApiBase(apiBaseUrl, `/api/admin/orders/${orderId}`),
        {},
        12000
      );
      setOrder(payload);
      setSelectedStatus(payload.status);
      setManagerComment(payload.manager_comment || "");
    } catch (fetchError) {
      if (fetchError instanceof ApiRequestError && (fetchError.status === 401 || fetchError.status === 403)) {
        router.push("/admin/login");
        return;
      }
      if (fetchError instanceof ApiRequestError) {
        setError(fetchError.traceId ? `${fetchError.message}. Код: ${fetchError.traceId}` : fetchError.message);
      } else {
        setError("Ошибка загрузки заказа");
      }
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    void fetchStatuses();
  }, [fetchStatuses]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  async function handleSave() {
    if (!order) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const payload = await fetchJsonWithTimeout<OrderDetails>(
        withApiBase(apiBaseUrl, `/api/admin/orders/${order.id}/status`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: selectedStatus,
            manager_comment: managerComment.trim() || null,
          }),
        },
        12000
      );
      setOrder(payload);
      setSelectedStatus(payload.status);
      setManagerComment(payload.manager_comment || "");
      setSuccess("Изменения сохранены");
    } catch (saveError) {
      if (saveError instanceof ApiRequestError && (saveError.status === 401 || saveError.status === 403)) {
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

  if (!order) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <p className="text-neutral-600">Заказ не найден</p>
        <Link href="/admin/orders" className="mt-3 inline-block text-[#1F3B73] hover:underline">
          Вернуться к списку заказов
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/orders" className="text-sm text-[#1F3B73] hover:underline">
          ← Назад к заказам
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[#1F3B73]">Заказ #{order.id}</h1>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#1F3B73]">Данные заказа</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-neutral-500">UUID</dt><dd className="break-all font-mono text-xs sm:text-sm">{order.uuid}</dd></div>
            <div><dt className="text-neutral-500">Статус</dt><dd>{statusLabel(order.status)}</dd></div>
            <div><dt className="text-neutral-500">Источник</dt><dd>{sourceLabel(order.source)}</dd></div>
            <div><dt className="text-neutral-500">Имя клиента</dt><dd>{order.customer_name || "—"}</dd></div>
            <div><dt className="text-neutral-500">Телефон</dt><dd>{order.customer_phone}</dd></div>
            <div><dt className="text-neutral-500">Email</dt><dd>{order.customer_email || "—"}</dd></div>
            <div><dt className="text-neutral-500">Доставка</dt><dd>{order.delivery_method || "—"}</dd></div>
            <div><dt className="text-neutral-500">Оплата</dt><dd>{order.payment_method || "—"}</dd></div>
            <div><dt className="text-neutral-500">Юрлицо</dt><dd>{order.legal_entity_name || "—"}</dd></div>
            <div><dt className="text-neutral-500">ИНН</dt><dd>{order.legal_entity_inn || "—"}</dd></div>
            <div>
              <dt className="text-neutral-500">Файл реквизитов</dt>
              <dd>
                {order.invoice_requisites_file_url ? (
                  <a
                    href={order.invoice_requisites_file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#1F3B73] hover:underline"
                  >
                    {order.invoice_requisites_file_name || "Открыть файл"}
                  </a>
                ) : "—"}
              </dd>
            </div>
            <div><dt className="text-neutral-500">Комментарий клиента</dt><dd className="whitespace-pre-wrap break-words">{order.comment || "—"}</dd></div>
            <div><dt className="text-neutral-500">Согласие 152-ФЗ</dt><dd>{order.consent_given ? "Да" : "Нет"}</dd></div>
            <div><dt className="text-neutral-500">Версия согласия</dt><dd>{order.consent_version || "—"}</dd></div>
            <div><dt className="text-neutral-500">Дата согласия</dt><dd>{order.consent_at ? new Date(order.consent_at).toLocaleString("ru-RU") : "—"}</dd></div>
            <div><dt className="text-neutral-500">Дата создания</dt><dd>{new Date(order.created_at).toLocaleString("ru-RU")}</dd></div>
            <div><dt className="text-neutral-500">Дата обновления</dt><dd>{new Date(order.updated_at).toLocaleString("ru-RU")}</dd></div>
          </dl>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#1F3B73]">Обработка</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Статус</label>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
              >
                {(statuses.length > 0 ? statuses : [order.status]).map((statusValue) => (
                  <option key={statusValue} value={statusValue}>
                    {statusLabel(statusValue)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Комментарий менеджера</label>
              <textarea
                rows={5}
                value={managerComment}
                onChange={(event) => setManagerComment(event.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={
                saving ||
                (selectedStatus === order.status &&
                  managerComment.trim() === (order.manager_comment || "").trim())
              }
              className="w-full rounded-xl bg-[#FF7A00] px-4 py-2 text-sm font-medium text-white hover:bg-[#e66e00] disabled:opacity-60"
            >
              {saving ? "Сохранение..." : "Сохранить изменения"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-[#1F3B73]">Позиции заказа</h2>
        {order.items.length === 0 ? (
          <p className="text-sm text-neutral-500">Позиции отсутствуют</p>
        ) : (
          <div>
            <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 md:hidden">
              {order.items.map((item) => (
                <article key={item.id} className="space-y-2 px-3 py-3 text-sm">
                  <p className="break-all font-medium text-neutral-900">{item.product_sku || "—"}</p>
                  <p className="text-neutral-700">{item.product_name}</p>
                  <p className="text-neutral-700">Кол-во: {item.quantity}</p>
                  <p className="text-neutral-700">Цена: {formatPrice(item.unit_price)}</p>
                  <p className="text-neutral-700">Сумма: {formatPrice(item.line_total)}</p>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-neutral-500">SKU</th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-neutral-500">Наименование</th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-neutral-500">Кол-во</th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-neutral-500">Цена</th>
                    <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-neutral-500">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 text-sm">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.product_sku || "—"}</td>
                      <td className="px-3 py-2">{item.product_name}</td>
                      <td className="px-3 py-2">{item.quantity}</td>
                      <td className="px-3 py-2">{formatPrice(item.unit_price)}</td>
                      <td className="px-3 py-2">{formatPrice(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
