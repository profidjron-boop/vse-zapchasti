'use client';

import Link from "next/link";
import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ leads: 'Загрузка...', service: 'Загрузка...' });

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        if (!token) {
          window.location.href = '/admin/login';
          return;
        }

        const headers = {
          'Authorization': `Bearer ${token}`,
        };

        const [leadsRes, serviceRes] = await Promise.all([
          fetch("http://localhost:8000/api/admin/leads?limit=1", { headers }),
          fetch("http://localhost:8000/api/admin/service-requests?limit=1", { headers })
        ]);

        if (cancelled) {
          return;
        }

        setStats({
          leads: leadsRes.ok ? "Есть данные" : "Нет данных",
          service: serviceRes.ok ? "Есть данные" : "Нет данных",
        });
      } catch {
        if (!cancelled) {
          setStats({ leads: "API недоступно", service: "API недоступно" });
        }
      }
    };

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, []);


  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1F3B73]">Дашборд</h1>
      <p className="mt-2 text-neutral-600">
        Добро пожаловать в админ-панель. Здесь будет статистика и управление.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm font-medium text-neutral-600">Заявки (запчасти)</div>
          <div className="mt-2 text-2xl font-bold text-[#1F3B73]">{stats.leads}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm font-medium text-neutral-600">Заявки (сервис)</div>
          <div className="mt-2 text-2xl font-bold text-[#1F3B73]">{stats.service}</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm font-medium text-neutral-600">Товары</div>
          <div className="mt-2 text-2xl font-bold text-[#1F3B73]">—</div>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="text-sm font-medium text-neutral-600">Категории</div>
          <div className="mt-2 text-2xl font-bold text-[#1F3B73]">—</div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Link
          href="/admin/leads"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">Заявки на запчасти</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Просмотр и обработка заявок от клиентов (VIN, обратный звонок, подбор)
          </p>
        </Link>
        <Link
          href="/admin/service-requests"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">Заявки на сервис</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Записи на ремонт и обслуживание, управление статусами
          </p>
        </Link>
        <Link
          href="/admin/products"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">Товары</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Управление каталогом запчастей, добавление и редактирование
          </p>
        </Link>
        <Link
          href="/admin/categories"
          className="rounded-2xl border border-neutral-200 bg-white p-6 transition hover:shadow-md"
        >
          <h2 className="text-lg font-semibold text-[#1F3B73]">Категории</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Структура категорий для каталога запчастей
          </p>
        </Link>
      </div>
    </div>
  );
}
