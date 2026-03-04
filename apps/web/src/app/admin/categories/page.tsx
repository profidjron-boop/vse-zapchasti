import Link from "next/link";

async function getCategories() {
  try {
    const res = await fetch("http://localhost:8000/api/admin/categories", {
      cache: 'no-store'
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function AdminCategoriesPage() {
  const categories = await getCategories();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1F3B73]">Управление категориями</h1>
        <Link
          href="/admin/categories/new"
          className="rounded-2xl bg-[#FF7A00] px-4 py-2 text-sm font-medium text-white hover:bg-[#e66e00]"
        >
          + Добавить категорию
        </Link>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          <p>Категорий пока нет</p>
          <p className="text-sm mt-2">Добавьте первую категорию через кнопку выше</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Название</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Slug</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Сортировка</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Активна</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {categories.map((cat: any) => (
                <tr key={cat.id} className="hover:bg-neutral-50">
                  <td className="py-3 px-4 text-sm">{cat.id}</td>
                  <td className="py-3 px-4 text-sm font-medium">{cat.name}</td>
                  <td className="py-3 px-4 text-sm font-mono">{cat.slug}</td>
                  <td className="py-3 px-4 text-sm">{cat.sort_order}</td>
                  <td className="py-3 px-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      cat.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {cat.is_active ? 'Да' : 'Нет'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    <Link
                      href={`/admin/categories/${cat.id}`}
                      className="text-[#1F3B73] hover:underline mr-3"
                    >
                      ✏️
                    </Link>
                    <button className="text-red-600 hover:underline">🗑️</button>
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
