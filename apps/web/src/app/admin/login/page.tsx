'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      console.log('Attempting login with:', email);
      
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      console.log('Sending request to:', 'http://localhost:8000/api/admin/auth/token');
      
      const res = await fetch('http://localhost:8000/api/admin/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      console.log('Response status:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error response:', errorText);
        throw new Error(`Ошибка ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      console.log('Token received:', data.access_token ? 'yes' : 'no');
      
      // Сохраняем токен в localStorage для клиентских запросов
      localStorage.setItem('admin_token', data.access_token);
      console.log('Token saved to localStorage');
      
      // Сохраняем токен в cookie для middleware и серверных компонентов
      Cookies.set('admin_token', data.access_token, { 
        expires: 7,
        path: '/',
        sameSite: 'strict'
      });
      console.log('Token saved to cookies');
      
      // Проверяем, что cookie установилась
      const savedCookie = Cookies.get('admin_token');
      console.log('Cookie after set:', savedCookie ? 'exists' : 'missing');
      
      router.push('/admin');
      router.refresh();
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#F5F7FA] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#1F3B73]">Все запчасти</h1>
          <p className="text-neutral-600 mt-2">Вход в админ-панель</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          {error && (
            <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-2xl bg-[#FF7A00] py-4 font-medium text-white shadow-lg shadow-[#FF7A00]/20 disabled:opacity-50 hover:bg-[#e66e00] transition"
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          <div className="mt-6 text-xs text-center text-neutral-500">
            demo: admin@vsezapchasti.ru / admin123
          </div>
        </div>
      </div>
    </div>
  );
}
