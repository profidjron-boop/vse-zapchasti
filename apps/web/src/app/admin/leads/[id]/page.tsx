'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getClientApiBaseUrl, withApiBase } from '@/lib/api-base-url';
import { ApiRequestError, fetchJsonWithTimeout } from '@/lib/fetch-json';

type Lead = {
  id: number;
  uuid: string;
  type: string;
  status: string;
  name: string | null;
  phone: string;
  email: string | null;
  message: string | null;
  vin: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  product_id: number | null;
  product_sku: string | null;
  manager_comment: string | null;
  consent_given: boolean;
  consent_version: string | null;
  consent_text: string | null;
  consent_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [comment, setComment] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const leadId = params.id;

  const fetchLead = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        router.push('/admin/login');
        return;
      }
      const apiBaseUrl = getClientApiBaseUrl();
      const data = await fetchJsonWithTimeout<Lead>(
        withApiBase(apiBaseUrl, `/api/admin/leads/${leadId}`),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        },
        12000
      );
      setLead(data);
      setSelectedStatus(data.status);
      setComment(data.manager_comment || '');
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        localStorage.removeItem('admin_token');
        router.push('/admin/login');
        return;
      }
      if (err instanceof ApiRequestError) {
        setError(err.traceId ? `${err.message}. Код: ${err.traceId}` : err.message);
      } else {
        setError('Ошибка загрузки заявки');
      }
    } finally {
      setLoading(false);
    }
  }, [leadId, router]);

  const fetchStatuses = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;
      const apiBaseUrl = getClientApiBaseUrl();
      const data = await fetchJsonWithTimeout<string[]>(
        withApiBase(apiBaseUrl, '/api/admin/leads/statuses'),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        },
        12000
      );
      if (Array.isArray(data)) {
        setStatuses(data);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    void fetchLead();
    void fetchStatuses();
  }, [fetchLead, fetchStatuses]);

  async function handleStatusUpdate() {
    setSaving(true);
    setError('');

    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        router.push('/admin/login');
        return;
      }
      const apiBaseUrl = getClientApiBaseUrl();
      const query = new URLSearchParams({ status: selectedStatus });
      query.set("comment", comment.trim());

      await fetchJsonWithTimeout<Lead>(
        withApiBase(apiBaseUrl, `/api/admin/leads/${leadId}/status?${query.toString()}`),
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        },
        12000
      );
      
      alert('Статус обновлён');
      fetchLead();
      setComment('');
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        localStorage.removeItem('admin_token');
        router.push('/admin/login');
        return;
      }
      if (err instanceof ApiRequestError) {
        setError(err.traceId ? `${err.message}. Код: ${err.traceId}` : err.message);
      } else {
        setError('Ошибка обновления статуса');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        router.push('/admin/login');
        return;
      }
      const apiBaseUrl = getClientApiBaseUrl();
      await fetchJsonWithTimeout<{ id: number }>(
        withApiBase(apiBaseUrl, `/api/admin/leads/${leadId}`),
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        },
        12000
      );
      
      router.push('/admin/leads');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        localStorage.removeItem('admin_token');
        router.push('/admin/login');
        return;
      }
      if (err instanceof ApiRequestError) {
        setError(err.traceId ? `${err.message}. Код: ${err.traceId}` : err.message);
      } else {
        setError('Ошибка удаления заявки');
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#1F3B73]">Загрузка...</div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-500">Заявка не найдена</p>
        <Link href="/admin/leads" className="text-[#1F3B73] hover:underline mt-4 inline-block">
          ← Вернуться к списку
        </Link>
      </div>
    );
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'product': return 'Запрос по товару';
      case 'callback': return 'Обратный звонок';
      case 'vin': return 'VIN';
      case 'parts_search': return 'Подбор';
      default: return type;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'Новая';
      case 'in_progress': return 'В работе';
      case 'contacted': return 'Связались';
      case 'offer_sent': return 'Предложение отправлено';
      case 'won': return 'Успешно';
      case 'lost': return 'Неуспешно';
      case 'closed': return 'Закрыта';
      case 'canceled': return 'Отменена';
      case 'scheduled': return 'Запланирована';
      default: return status;
    }
  };

  const statusColors = {
    new: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    contacted: 'bg-purple-100 text-purple-700',
    offer_sent: 'bg-indigo-100 text-indigo-700',
    won: 'bg-green-100 text-green-700',
    lost: 'bg-red-100 text-red-700',
    closed: 'bg-gray-100 text-gray-700',
    canceled: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-gray-100 text-gray-700',
    scheduled: 'bg-cyan-100 text-cyan-700',
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/leads"
          className="text-[#1F3B73] hover:underline"
        >
          ← Назад к заявкам
        </Link>
        <h1 className="text-2xl font-bold text-[#1F3B73]">
          Заявка #{lead.id}
        </h1>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600 border border-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Основная информация */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-[#1F3B73] mb-4">Детали заявки</h2>
            
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-neutral-500">Статус</dt>
                <dd>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[lead.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-700'}`}>
                    {getStatusLabel(lead.status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Тип</dt>
                <dd className="font-medium">
                  {getTypeLabel(lead.type)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Дата создания</dt>
                <dd>{new Date(lead.created_at).toLocaleString('ru-RU')}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">UUID</dt>
                <dd className="font-mono text-sm">{lead.uuid}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-[#1F3B73] mb-4">Контактная информация</h2>
            
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-neutral-500">Имя</dt>
                <dd>{lead.name || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Телефон</dt>
                <dd className="font-medium">{lead.phone}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Email</dt>
                <dd>{lead.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Согласие на ПДн</dt>
                <dd>{lead.consent_given ? 'Да' : 'Нет'}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Версия согласия</dt>
                <dd>{lead.consent_version || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-neutral-500">Дата согласия</dt>
                <dd>{lead.consent_at ? new Date(lead.consent_at).toLocaleString('ru-RU') : '—'}</dd>
              </div>
            </dl>
            {lead.consent_text && (
              <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
                <div className="mb-1 text-xs text-neutral-500">Текст согласия</div>
                <div>{lead.consent_text}</div>
              </div>
            )}
          </div>

          {(lead.vin || lead.vehicle_make || lead.message) && (
            <div className="bg-white rounded-2xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-[#1F3B73] mb-4">Дополнительная информация</h2>
              
              <dl className="space-y-3">
                {lead.vin && (
                  <div>
                    <dt className="text-sm text-neutral-500">VIN</dt>
                    <dd className="font-mono">{lead.vin}</dd>
                  </div>
                )}
                {(lead.vehicle_make || lead.vehicle_model) && (
                  <div>
                    <dt className="text-sm text-neutral-500">Автомобиль</dt>
                    <dd>{[lead.vehicle_make, lead.vehicle_model, lead.vehicle_year].filter(Boolean).join(' ')}</dd>
                  </div>
                )}
                {lead.message && (
                  <div>
                    <dt className="text-sm text-neutral-500">Сообщение</dt>
                    <dd className="whitespace-pre-wrap bg-neutral-50 p-3 rounded-xl">{lead.message}</dd>
                  </div>
                )}
                {lead.product_sku && (
                  <div>
                    <dt className="text-sm text-neutral-500">Товар</dt>
                    <dd>{lead.product_sku}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        {/* Боковая панель с действиями */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-[#1F3B73] mb-4">Изменить статус</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Новый статус
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
                >
                  {statuses.map(s => (
                    <option key={s} value={s}>{getStatusLabel(s)}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Заметка менеджера
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
                />
              </div>

              <button
                onClick={handleStatusUpdate}
                disabled={
                  saving ||
                  (selectedStatus === lead.status &&
                    comment.trim() === (lead.manager_comment || "").trim())
                }
                className="w-full rounded-2xl bg-[#1F3B73] py-3 font-medium text-white hover:bg-[#14294F] disabled:opacity-50 transition"
              >
                {saving ? 'Сохранение...' : 'Обновить статус'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-[#1F3B73] mb-4">Опасная зона</h2>
            
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full rounded-2xl border-2 border-red-500 bg-red-50 py-3 font-medium text-red-600 hover:bg-red-100 transition"
              >
                Удалить заявку
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-neutral-600">
                  Вы уверены? Это действие нельзя отменить.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDelete}
                    className="flex-1 rounded-2xl bg-red-500 py-2 font-medium text-white hover:bg-red-600 transition"
                  >
                    Да, удалить
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 rounded-2xl border border-neutral-200 py-2 font-medium text-neutral-600 hover:bg-neutral-50 transition"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
