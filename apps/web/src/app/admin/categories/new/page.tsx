'use client';

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCategoryPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const data = {
      name: formData.get("name"),
      slug: formData.get("slug"),
      parent_id: formData.get("parent_id") ? parseInt(formData.get("parent_id") as string) : null,
      sort_order: parseInt(formData.get("sort_order") as string) || 0,
      is_active: formData.get("is_active") === "on",
    };

    try {
      const response = await fetch("http://localhost:8000/api/admin/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Ошибка при создании категории");
      }

      router.push("/admin/categories");
      router.refresh();
    } catch (err) {
      setError("Не удалось создать категорию. Попробуйте позже.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/categories"
          className="text-[#1F3B73] hover:underline"
        >
          ← Назад к категориям
        </Link>
        <h1 className="text-2xl font-bold text-[#1F3B73]">Новая категория</h1>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-600 border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Название *
          </label>
          <input
            type="text"
            name="name"
            required
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Slug *
          </label>
          <input
            type="text"
            name="slug"
            required
            placeholder="например: zapchasti"
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Уникальный идентификатор для URL (только латиница, цифры, дефис)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            ID родительской категории
          </label>
          <input
            type="number"
            name="parent_id"
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Порядок сортировки
          </label>
          <input
            type="number"
            name="sort_order"
            defaultValue="0"
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 focus:border-[#1F3B73] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="is_active"
            id="is_active"
            defaultChecked={true}
            className="rounded border-neutral-300 text-[#1F3B73] focus:ring-[#1F3B73]"
          />
          <label htmlFor="is_active" className="text-sm text-neutral-700">
            Активна (показывать на сайте)
          </label>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl bg-[#FF7A00] px-6 py-3 font-medium text-white hover:bg-[#e66e00] disabled:opacity-50 transition"
          >
            {isSubmitting ? "Сохранение..." : "Создать категорию"}
          </button>
        </div>
      </form>
    </div>
  );
}
