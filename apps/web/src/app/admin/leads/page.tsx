'use client';

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  vin: string | null;
  created_at: string;
};

type LeadsFilters = {
  status: string;
  type: string;
  search: string;
  dateFrom: string;
  dateTo: string;
};

type FilterPreset = {
  id: string;
  name: string;
  filters: LeadsFilters;
};

const FILTER_PRESETS_STORAGE_KEY = 'admin_leads_filter_presets_v1';

const defaultFilters: LeadsFilters = {
  status: '',
  type: '',
  search: '',
  dateFrom: '',
  dateTo: '',
};

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingDeleteLeadId, setPendingDeleteLeadId] = useState<number | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [filters, setFilters] = useState<LeadsFilters>(defaultFilters);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [statuses, setStatuses] = useState<string[]>([]);
  const searchRef = useRef(filters.search);

  const fetchStatuses = useCallback(async () => {
    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const data = await fetchJsonWithTimeout<string[]>(
        withApiBase(apiBaseUrl, '/api/admin/leads/statuses'),
        {},
        12000
      );
      if (Array.isArray(data)) {
        setStatuses(data);
      }
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        router.push('/admin/login');
      }
    }
  }, [router]);

  const fetchLeads = useCallback(async (searchTerm: string, showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    }

    try {
      // Строим URL с фильтрами
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.type) params.append('type', filters.type);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (filters.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters.dateTo) params.append('date_to', filters.dateTo);
      params.append('skip', String((page - 1) * pageSize));
      params.append('limit', String(pageSize + 1));
      
      const apiBaseUrl = getClientApiBaseUrl();
      const url = withApiBase(apiBaseUrl, `/api/admin/leads?${params.toString()}`);

      const data = await fetchJsonWithTimeout<Lead[]>(
        url,
        {},
        12000
      );
      const nextPageAvailable = data.length > pageSize;
      const pageRows = nextPageAvailable ? data.slice(0, pageSize) : data;
      setLeads(pageRows);
      setHasNextPage(nextPageAvailable);
      setSelectedLeadIds((prev) => prev.filter((id) => pageRows.some((lead: Lead) => lead.id === id)));
      setLastUpdated(new Date().toLocaleTimeString('ru-RU'));
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        router.push('/admin/login');
        return;
      }
      if (err instanceof ApiRequestError) {
        setError(err.traceId ? `${err.message}. Код: ${err.traceId}` : err.message);
      } else {
        setError('Ошибка загрузки заявок');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [router, filters.status, filters.type, filters.dateFrom, filters.dateTo, page, pageSize]);

  useEffect(() => {
    searchRef.current = filters.search;
  }, [filters.search]);

  useEffect(() => {
    void fetchStatuses();
  }, [fetchStatuses]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_PRESETS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as FilterPreset[];
      if (Array.isArray(parsed)) {
        setPresets(parsed);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    void fetchLeads(searchRef.current);
  }, [fetchLeads]);

  async function handleDelete(id: number) {
    try {
      const apiBaseUrl = getClientApiBaseUrl();
      await fetchJsonWithTimeout<{ id: number }>(
        withApiBase(apiBaseUrl, `/api/admin/leads/${id}`),
        {
          method: 'DELETE',
        },
        12000
      );
      
      setLeads(leads.filter(l => l.id !== id));
      setSelectedLeadIds((prev) => prev.filter((leadId) => leadId !== id));
      if (pendingDeleteLeadId === id) {
        setPendingDeleteLeadId(null);
      }
      setSuccess(`Заявка #${id} удалена`);
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        router.push('/admin/login');
        return;
      }
      if (err instanceof ApiRequestError) {
        setError(err.traceId ? `${err.message}. Код: ${err.traceId}` : err.message);
      } else {
        setError('Ошибка при удалении');
      }
      setPendingDeleteLeadId(null);
    }
  }

  async function handleBulkStatusUpdate() {
    if (selectedLeadIds.length === 0) {
      setError('Выберите хотя бы одну заявку');
      return;
    }
    if (!bulkStatus) {
      setError('Выберите статус для массового обновления');
      return;
    }

    setBulkUpdating(true);
    setError('');
    setSuccess('');

    try {
      const apiBaseUrl = getClientApiBaseUrl();
      let updated = 0;
      let failed = 0;
      let firstError = '';

      for (const leadId of selectedLeadIds) {
        const params = new URLSearchParams({ status: bulkStatus });
        try {
          await fetchJsonWithTimeout<Lead>(
            withApiBase(apiBaseUrl, `/api/admin/leads/${leadId}/status?${params.toString()}`),
            {
              method: 'PUT',
            },
            12000
          );
          updated += 1;
        } catch (updateError) {
          if (updateError instanceof ApiRequestError && (updateError.status === 401 || updateError.status === 403)) {
            router.push('/admin/login');
            return;
          }
          failed += 1;
          if (!firstError) {
            if (updateError instanceof ApiRequestError) {
              firstError = updateError.traceId
                ? `${updateError.message}. Код: ${updateError.traceId}`
                : updateError.message;
            } else {
              firstError = `Ошибка обновления ID ${leadId}`;
            }
          }
        }
      }

      if (updated > 0) {
        setSuccess(`Обновлено: ${updated}. Ошибок: ${failed}.`);
      }
      if (failed > 0) {
        setError(firstError || `Не удалось обновить ${failed} заявок`);
      }

      setSelectedLeadIds([]);
      setBulkStatus('');
      await fetchLeads(filters.search, true);
    } finally {
      setBulkUpdating(false);
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (page !== 1) {
      setPage(1);
      return;
    }
    void fetchLeads(filters.search, true);
  };

  const allSelected = leads.length > 0 && selectedLeadIds.length === leads.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedLeadIds([]);
      return;
    }
    setSelectedLeadIds(leads.map((lead) => lead.id));
  };

  const toggleSelectLead = (leadId: number) => {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId)
        ? prev.filter((id) => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setPage(1);
    setError('');
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) {
      setError('Введите имя пресета');
      return;
    }
    const preset: FilterPreset = {
      id: `${Date.now()}`,
      name,
      filters,
    };
    const next = [preset, ...presets];
    setPresets(next);
    setPresetName('');
    localStorage.setItem(FILTER_PRESETS_STORAGE_KEY, JSON.stringify(next));
    setSuccess(`Пресет "${name}" сохранён`);
  };

  const handleApplyPreset = () => {
    const preset = presets.find((item) => item.id === selectedPresetId);
    if (!preset) {
      setError('Выберите пресет');
      return;
    }
    setFilters(preset.filters);
    setPage(1);
    setError('');
    setSuccess(`Применён пресет "${preset.name}"`);
  };

  const handleDeletePreset = () => {
    if (!selectedPresetId) {
      setError('Выберите пресет для удаления');
      return;
    }
    const next = presets.filter((item) => item.id !== selectedPresetId);
    setPresets(next);
    setSelectedPresetId('');
    localStorage.setItem(FILTER_PRESETS_STORAGE_KEY, JSON.stringify(next));
    setSuccess('Пресет удалён');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#1F3B73]">Загрузка...</div>
      </div>
    );
  }

  const getTypeLabel = (type: string) => {
    switch(type) {
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

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'new': return 'bg-blue-100 text-blue-700';
      case 'in_progress': return 'bg-yellow-100 text-yellow-700';
      case 'contacted': return 'bg-purple-100 text-purple-700';
      case 'offer_sent': return 'bg-indigo-100 text-indigo-700';
      case 'won': return 'bg-green-100 text-green-700';
      case 'lost': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const toCsvCell = (value: string) => {
    const normalized = value.replace(/"/g, '""');
    return /[;"\n]/.test(normalized) ? `"${normalized}"` : normalized;
  };

  const handleExportCsv = () => {
    if (leads.length === 0) {
      setError('Нет данных для экспорта');
      return;
    }

    const headers = ['ID', 'Тип', 'Статус', 'Телефон', 'Имя', 'Email', 'VIN', 'Дата'];
    const rows = leads.map((lead) => [
      String(lead.id),
      getTypeLabel(lead.type),
      getStatusLabel(lead.status),
      lead.phone || '',
      lead.name || '',
      lead.email || '',
      lead.vin || '',
      new Date(lead.created_at).toLocaleString('ru-RU'),
    ]);

    const csv = [
      headers.map(toCsvCell).join(';'),
      ...rows.map((row) => row.map(toCsvCell).join(';')),
    ].join('\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateLabel = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `leads-${dateLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSuccess('CSV экспортирован');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#1F3B73]">Заявки на запчасти</h1>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-neutral-500">Обновлено: {lastUpdated}</span>
          )}
          <button
            type="button"
            onClick={() => void fetchLeads(filters.search, true)}
            disabled={isRefreshing}
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            {isRefreshing ? 'Обновление...' : 'Обновить'}
          </button>
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 mb-6">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Поиск</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              placeholder="Телефон, имя, email, VIN"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Статус</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
            >
              <option value="">Все</option>
              {statuses.map(s => (
                <option key={s} value={s}>{getStatusLabel(s)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Тип</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({...filters, type: e.target.value})}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
            >
              <option value="">Все</option>
              <option value="product">Запрос по товару</option>
              <option value="callback">Обратный звонок</option>
              <option value="vin">VIN</option>
              <option value="parts_search">Подбор</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Дата с</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Дата по</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
            />
          </div>

          <div className="md:col-span-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-xl border border-neutral-300 bg-white px-6 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition"
            >
              Сбросить
            </button>
            <button
              type="submit"
              disabled={isRefreshing}
              className="rounded-xl bg-[#1F3B73] px-6 py-2 text-sm font-medium text-white hover:bg-[#14294F] transition disabled:opacity-50"
            >
              {isRefreshing ? 'Загрузка...' : 'Применить фильтры'}
            </button>
          </div>
        </form>
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_auto_auto]">
            <input
              type="text"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="Имя пресета фильтров"
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
            />
            <select
              value={selectedPresetId}
              onChange={(event) => setSelectedPresetId(event.target.value)}
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
            >
              <option value="">Выберите пресет</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSavePreset}
              className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Сохранить пресет
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleApplyPreset}
                className="rounded-xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#14294F]"
              >
                Применить
              </button>
              <button
                type="button"
                onClick={handleDeletePreset}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600 border border-red-200">
          {error}
        </div>
      )}
      {success && (
        <div role="status" aria-live="polite" className="mb-6 rounded-2xl bg-green-50 p-4 text-sm text-green-700 border border-green-200">
          {success}
        </div>
      )}

      {leads.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          {filters.status || filters.type || filters.search.trim() || filters.dateFrom || filters.dateTo ? (
            <>
              <p>По выбранным фильтрам заявок не найдено</p>
              <p className="text-sm mt-2">Попробуйте изменить параметры поиска или сбросить фильтры</p>
            </>
          ) : (
            <>
              <p>Заявок пока нет</p>
              <p className="text-sm mt-2">Заявки появятся здесь после отправки форм на сайте</p>
            </>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
            <div className="text-sm text-neutral-500">Показано на странице: {leads.length} · Страница {page}</div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm text-neutral-600">Выбрано: {selectedLeadIds.length}</div>
              <select
                value={bulkStatus}
                onChange={(event) => setBulkStatus(event.target.value)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
              >
              <option value="">Статус для выбранных</option>
              {statuses.map((statusValue) => (
                  <option key={statusValue} value={statusValue}>{getStatusLabel(statusValue)}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleBulkStatusUpdate()}
                disabled={bulkUpdating || selectedLeadIds.length === 0 || !bulkStatus}
                className="rounded-xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#14294F] disabled:opacity-50"
              >
                {bulkUpdating ? 'Обновление...' : 'Применить к выбранным'}
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Экспорт CSV
              </button>
              <select
                value={String(pageSize)}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
              >
                <option value="25">25 на странице</option>
                <option value="50">50 на странице</option>
                <option value="100">100 на странице</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white md:hidden">
            {leads.map((lead) => (
              <article key={lead.id} className="space-y-3 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <label className="flex items-center gap-2 text-sm text-neutral-600">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={() => toggleSelectLead(lead.id)}
                        aria-label={`Выбрать заявку ${lead.id}`}
                      />
                      <span>#{lead.id}</span>
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#1F3B73]/10 px-2 py-1 text-xs text-[#1F3B73]">
                        {getTypeLabel(lead.type)}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-xs ${getStatusColor(lead.status)}`}>
                        {getStatusLabel(lead.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1 text-sm text-neutral-700">
                  <p>Телефон: {lead.phone}</p>
                  <p>Имя: {lead.name || "—"}</p>
                  <p className="break-all font-mono">VIN: {lead.vin || "—"}</p>
                  <p className="text-xs text-neutral-500">{new Date(lead.created_at).toLocaleString("ru-RU")}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/admin/leads/${lead.id}`}
                    className="text-sm font-medium text-[#1F3B73] hover:underline"
                    aria-label={`Открыть заявку ${lead.id}`}
                  >
                    Открыть
                  </Link>
                  {pendingDeleteLeadId === lead.id ? (
                    <>
                      <button
                        onClick={() => void handleDelete(lead.id)}
                        className="rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                        aria-label={`Подтвердить удаление заявки ${lead.id}`}
                      >
                        Подтвердить
                      </button>
                      <button
                        onClick={() => setPendingDeleteLeadId(null)}
                        className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100"
                        aria-label={`Отменить удаление заявки ${lead.id}`}
                      >
                        Отмена
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setPendingDeleteLeadId(lead.id)}
                      className="text-xs text-red-600 hover:underline"
                      aria-label={`Удалить заявку ${lead.id}`}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-neutral-200 bg-white md:block">
            <table className="w-full min-w-[980px]">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Выбрать все заявки"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Тип</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Статус</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Телефон</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Имя</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">VIN</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Дата</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-neutral-50">
                    <td className="py-3 px-4 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={() => toggleSelectLead(lead.id)}
                        aria-label={`Выбрать заявку ${lead.id}`}
                      />
                    </td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">#{lead.id}</td>
                    <td className="py-3 px-4 text-sm">
                      <span className="px-2 py-1 rounded-full bg-[#1F3B73]/10 text-[#1F3B73] text-xs">
                        {getTypeLabel(lead.type)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(lead.status)}`}>
                        {getStatusLabel(lead.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">{lead.phone}</td>
                    <td className="py-3 px-4 text-sm">{lead.name || "—"}</td>
                    <td className="py-3 px-4 text-sm font-mono whitespace-nowrap">{lead.vin || "—"}</td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleString("ru-RU")}
                    </td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">
                      <Link
                        href={`/admin/leads/${lead.id}`}
                        className="text-[#1F3B73] hover:underline mr-3"
                        aria-label={`Открыть заявку ${lead.id}`}
                      >
                        👁️
                      </Link>
                      {pendingDeleteLeadId === lead.id ? (
                        <>
                          <button
                            onClick={() => void handleDelete(lead.id)}
                            className="mr-2 rounded-lg border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                            aria-label={`Подтвердить удаление заявки ${lead.id}`}
                          >
                            Подтвердить
                          </button>
                          <button
                            onClick={() => setPendingDeleteLeadId(null)}
                            className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100"
                            aria-label={`Отменить удаление заявки ${lead.id}`}
                          >
                            Отмена
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setPendingDeleteLeadId(lead.id)}
                          className="text-red-600 hover:underline"
                          aria-label={`Удалить заявку ${lead.id}`}
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-3">
            <div className="text-sm text-neutral-500">Страница: {page}</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || isRefreshing}
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={!hasNextPage || isRefreshing}
                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
              >
                Вперёд
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
