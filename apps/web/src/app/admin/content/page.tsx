'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getClientApiBaseUrl, withApiBase } from '@/lib/api-base-url';

type ContentBlock = {
  key: string;
  value: string | null;
  type: 'text' | 'image' | 'html';
  description: string | null;
};

export default function ContentEditorPage() {
  const [content, setContent] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingKey, setDeletingKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingValue, setEditingValue] = useState<{[key: string]: string}>({});
  const [newBlock, setNewBlock] = useState({
    key: '',
    value: '',
    type: 'text' as ContentBlock['type'],
    description: '',
  });

  useEffect(() => {
    fetchContent();
  }, []);

  async function fetchContent() {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        window.location.href = '/admin/login';
        return;
      }
      
      const apiBaseUrl = getClientApiBaseUrl();
      const res = await fetch(withApiBase(apiBaseUrl, '/api/admin/content'), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (res.status === 401) {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
        return;
      }
      
      if (!res.ok) throw new Error('Failed to fetch content');
      const data = await res.json();
      setContent(data);
      
      const initialValues: {[key: string]: string} = {};
      data.forEach((block: ContentBlock) => {
        initialValues[block.key] = block.value || '';
      });
      setEditingValue(initialValues);
    } catch (err) {
      setError('Ошибка загрузки контента');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(key: string) {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('admin_token');
      const apiBaseUrl = getClientApiBaseUrl();
      const res = await fetch(withApiBase(apiBaseUrl, `/api/admin/content/${encodeURIComponent(key)}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ value: editingValue[key] }),
      });

      if (res.status === 401) {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
        return;
      }
      
      if (!res.ok) throw new Error('Failed to save');
      
      setSuccess(`Блок "${key}" сохранён`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Ошибка сохранения блока "${key}"`);
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(key: string, file: File) {
    setUploading(true);
    setError('');

    try {
      const token = localStorage.getItem('admin_token');
      const formData = new FormData();
      formData.append('file', file);

      const apiBaseUrl = getClientApiBaseUrl();
      const res = await fetch(withApiBase(apiBaseUrl, '/api/admin/upload'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.status === 401) {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
        return;
      }
      
      if (!res.ok) throw new Error('Upload failed');
      
      const data = await res.json();
      setEditingValue(prev => ({...prev, [key]: data.url}));
      
      setSuccess(`Изображение загружено`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Ошибка загрузки изображения');
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateBlock() {
    if (!newBlock.key.trim()) {
      setError('Ключ блока обязателен');
      return;
    }

    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('admin_token');
      const apiBaseUrl = getClientApiBaseUrl();
      const response = await fetch(withApiBase(apiBaseUrl, '/api/admin/content'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          key: newBlock.key.trim(),
          value: newBlock.value || null,
          type: newBlock.type,
          description: newBlock.description || null,
        }),
      });

      if (response.status === 401) {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
        return;
      }

      if (!response.ok) throw new Error('Failed to create content block');
      const createdBlock = await response.json() as ContentBlock;

      setContent(prev => [...prev, createdBlock].sort((a, b) => a.key.localeCompare(b.key)));
      setEditingValue(prev => ({ ...prev, [createdBlock.key]: createdBlock.value || '' }));
      setNewBlock({ key: '', value: '', type: 'text', description: '' });
      setSuccess(`Блок "${createdBlock.key}" создан`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (createError) {
      console.error(createError);
      setError('Ошибка создания блока');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteBlock(key: string) {
    if (!confirm(`Удалить блок "${key}"?`)) return;

    setDeletingKey(key);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('admin_token');
      const apiBaseUrl = getClientApiBaseUrl();
      const response = await fetch(withApiBase(apiBaseUrl, `/api/admin/content/${encodeURIComponent(key)}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
        return;
      }

      if (!response.ok) throw new Error('Failed to delete content block');

      setContent(prev => prev.filter(block => block.key !== key));
      setEditingValue(prev => {
        const next = {...prev};
        delete next[key];
        return next;
      });
      setSuccess(`Блок "${key}" удалён`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (deleteError) {
      console.error(deleteError);
      setError(`Ошибка удаления блока "${key}"`);
    } finally {
      setDeletingKey('');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#1F3B73]">Загрузка...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1F3B73] mb-6">Редактор контента сайта</h1>
      
      {error && (
        <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600 border border-red-200">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-6 rounded-2xl bg-green-50 p-4 text-sm text-green-600 border border-green-200">
          {success}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-[#1F3B73]">Новый блок</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Ключ *</label>
            <input
              type="text"
              value={newBlock.key}
              onChange={(e) => setNewBlock({...newBlock, key: e.target.value})}
              placeholder="например: hero_title"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Тип</label>
            <select
              value={newBlock.type}
              onChange={(e) => setNewBlock({...newBlock, type: e.target.value as ContentBlock['type']})}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            >
              <option value="text">Текст</option>
              <option value="image">Изображение</option>
              <option value="html">HTML</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-neutral-700">Описание</label>
            <input
              type="text"
              value={newBlock.description}
              onChange={(e) => setNewBlock({...newBlock, description: e.target.value})}
              placeholder="Описание для админки"
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-neutral-700">Значение</label>
            <textarea
              rows={4}
              value={newBlock.value}
              onChange={(e) => setNewBlock({...newBlock, value: e.target.value})}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleCreateBlock}
            disabled={creating}
            className="rounded-2xl bg-[#1F3B73] px-6 py-2 text-sm font-medium text-white hover:bg-[#14294F] disabled:opacity-50"
          >
            {creating ? 'Создание...' : 'Создать блок'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {content.map((block) => (
          <div key={block.key} className="border border-neutral-200 rounded-2xl bg-white p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-[#1F3B73]">{block.key}</h3>
                {block.description && (
                  <p className="text-sm text-neutral-500 mt-1">{block.description}</p>
                )}
                <span className="inline-block mt-2 text-xs px-2 py-1 bg-neutral-100 rounded-full">
                  {block.type === 'text' ? 'Текст' : block.type === 'image' ? 'Изображение' : 'HTML'}
                </span>
              </div>
            </div>

            {block.type === 'text' && (
              <div>
                <textarea
                  value={editingValue[block.key] || ''}
                  onChange={(e) => setEditingValue({...editingValue, [block.key]: e.target.value})}
                  rows={5}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
                />
              </div>
            )}

            {block.type === 'image' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    URL изображения
                  </label>
                  <input
                    type="text"
                    value={editingValue[block.key] || ''}
                    onChange={(e) => setEditingValue({...editingValue, [block.key]: e.target.value})}
                    placeholder="URL изображения"
                    className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Или загрузите файл
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(block.key, file);
                      }}
                      className="flex-1 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-2xl file:border-0 file:bg-[#1F3B73] file:text-white hover:file:bg-[#14294F]"
                    />
                    {uploading && (
                      <div className="flex items-center text-sm text-neutral-500">
                        Загрузка...
                      </div>
                    )}
                  </div>
                </div>

                {editingValue[block.key] && (
                  <div className="mt-4">
                    <p className="text-sm text-neutral-500 mb-2">Предпросмотр:</p>
                    <div className="relative h-40 w-40 border border-neutral-200 rounded-2xl overflow-hidden">
                      <Image 
                        src={editingValue[block.key]} 
                        alt={block.key}
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {block.type === 'html' && (
              <div>
                <textarea
                  value={editingValue[block.key] || ''}
                  onChange={(e) => setEditingValue({...editingValue, [block.key]: e.target.value})}
                  rows={8}
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm focus:border-[#1F3B73] focus:outline-none"
                />
              </div>
            )}

            <div className="mt-4 flex justify-between">
              <button
                onClick={() => handleDeleteBlock(block.key)}
                disabled={saving || uploading || deletingKey === block.key}
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                {deletingKey === block.key ? 'Удаление...' : 'Удалить'}
              </button>
              <button
                onClick={() => handleSave(block.key)}
                disabled={saving || uploading}
                className="rounded-2xl bg-[#FF7A00] px-6 py-2 text-sm font-medium text-white hover:bg-[#e66e00] disabled:opacity-50 transition"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {content.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200">
          <p className="text-neutral-500">Нет доступных блоков контента</p>
          <p className="text-sm text-neutral-400 mt-2">
            Добавьте блоки через базу данных или API
          </p>
        </div>
      )}
    </div>
  );
}
