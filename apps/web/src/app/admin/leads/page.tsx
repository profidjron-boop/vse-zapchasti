'use client';

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getClientApiBaseUrl, withApiBase } from '@/lib/api-base-url';

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

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    search: '',
    dateFrom: '',
    dateTo: '',
  });
  const [statuses, setStatuses] = useState<string[]>([]);
  const searchRef = useRef(filters.search);

  const fetchStatuses = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const apiBaseUrl = getClientApiBaseUrl();
      const res = await fetch(withApiBase(apiBaseUrl, '/api/admin/leads/statuses'), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatuses(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchLeads = useCallback(async (searchTerm: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        router.push('/admin/login');
        return;
      }

      // Строим URL с фильтрами
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.type) params.append('type', filters.type);
      if (filters.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters.dateTo) params.append('date_to', filters.dateTo);
      
      const apiBaseUrl = getClientApiBaseUrl();
      const url = withApiBase(apiBaseUrl, `/api/admin/leads?limit=50&${params.toString()}`);

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        localStorage.removeItem('admin_token');
        router.push('/admin/login');
        return;
      }

      if (!res.ok) throw new Error('Failed to fetch');
      
      const data = await res.json();
      // Фильтруем по поиску на клиенте (можно и на сервере, но для простоты пока так)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        setLeads(data.filter((l: Lead) => 
          l.phone?.toLowerCase().includes(searchLower) ||
          l.name?.toLowerCase().includes(searchLower) ||
          l.email?.toLowerCase().includes(searchLower) ||
          l.vin?.toLowerCase().includes(searchLower)
        ));
      } else {
        setLeads(data);
      }
    } catch (err) {
      setError('Ошибка загрузки заявок');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router, filters.status, filters.type, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    searchRef.current = filters.search;
  }, [filters.search]);

  useEffect(() => {
    void fetchStatuses();
  }, [fetchStatuses]);

  useEffect(() => {
    void fetchLeads(searchRef.current);
  }, [fetchLeads]);

  async function handleDelete(id: number) {
    if (!confirm('Удалить заявку?')) return;
    
    try {
      const token = localStorage.getItem('admin_token');
      const apiBaseUrl = getClientApiBaseUrl();
      const res = await fetch(withApiBase(apiBaseUrl, `/api/admin/leads/${id}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        localStorage.removeItem('admin_token');
        router.push('/admin/login');
        return;
      }

      if (!res.ok) throw new Error('Failed to delete');
      
      setLeads(leads.filter(l => l.id !== id));
    } catch (err) {
      alert('Ошибка при удалении');
      console.error(err);
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchLeads(filters.search);
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
      case 'vin': return 'VIN';
      case 'callback': return 'Звонок';
      case 'product': return 'Товар';
      default: return 'Подбор';
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#1F3B73]">Заявки на запчасти</h1>
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
                <option key={s} value={s}>{s}</option>
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
              <option value="vin">VIN</option>
              <option value="callback">Звонок</option>
              <option value="product">Товар</option>
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

          <div className="md:col-span-5 flex justify-end">
            <button
              type="submit"
              className="rounded-xl bg-[#1F3B73] px-6 py-2 text-sm font-medium text-white hover:bg-[#14294F] transition"
            >
              Применить фильтры
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600 border border-red-200">
          {error}
        </div>
      )}

      {leads.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          <p>Заявок пока нет</p>
          <p className="text-sm mt-2">Заявки появятся здесь после отправки форм на сайте</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
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
                  <td className="py-3 px-4 text-sm">#{lead.id}</td>
                  <td className="py-3 px-4 text-sm">
                    <span className="px-2 py-1 rounded-full bg-[#1F3B73]/10 text-[#1F3B73] text-xs">
                      {getTypeLabel(lead.type)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(lead.status)}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">{lead.phone}</td>
                  <td className="py-3 px-4 text-sm">{lead.name || '—'}</td>
                  <td className="py-3 px-4 text-sm font-mono">{lead.vin || '—'}</td>
                  <td className="py-3 px-4 text-sm">
                    {new Date(lead.created_at).toLocaleString('ru-RU')}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <Link
                      href={`/admin/leads/${lead.id}`}
                      className="text-[#1F3B73] hover:underline mr-3"
                    >
                      👁️
                    </Link>
                    <button
                      onClick={() => handleDelete(lead.id)}
                      className="text-red-600 hover:underline"
                    >
                      🗑️
                    </button>
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
