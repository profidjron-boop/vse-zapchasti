'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingValue, setEditingValue] = useState<{[key: string]: string}>({});

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
      
      const res = await fetch('http://localhost:8000/api/admin/content', {
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
      const res = await fetch(`http://localhost:8000/api/admin/content/${key}`, {
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

      const res = await fetch('http://localhost:8000/api/admin/upload', {
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
      setEditingValue({...editingValue, [key]: data.url});
      
      setSuccess(`Изображение загружено`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Ошибка загрузки изображения');
      console.error(err);
    } finally {
      setUploading(false);
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

            <div className="mt-4 flex justify-end">
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
