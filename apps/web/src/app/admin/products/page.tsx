type Product = {
  id: number;
  sku: string;
  oem: string | null;
  brand: string | null;
  name: string;
  description: string | null;
  price: number | null;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

import Link from "next/link";
import { getServerApiBaseUrl, withApiBase } from "@/lib/api-base-url";

async function getProducts() {
  try {
    const apiBaseUrl = getServerApiBaseUrl();
    const res = await fetch(withApiBase(apiBaseUrl, "/api/public/products?limit=50"), {
      cache: 'no-store'
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function AdminProductsPage() {
  const products = await getProducts();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1F3B73]">Управление товарами</h1>
        <Link
          href="/admin/products/new"
          className="rounded-2xl bg-[#FF7A00] px-4 py-2 text-sm font-medium text-white hover:bg-[#e66e00]"
        >
          + Добавить товар
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 text-neutral-500">
          <p>Товаров пока нет</p>
          <p className="text-sm mt-2">Добавьте первый товар через кнопку выше</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">SKU</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">OEM</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Название</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Бренд</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Цена</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Остаток</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {products.map((product: Product) => (
                <tr key={product.id} className="hover:bg-neutral-50">
                  <td className="py-3 px-4 text-sm">{product.sku}</td>
                  <td className="py-3 px-4 text-sm">{product.oem || "—"}</td>
                  <td className="py-3 px-4 text-sm font-medium">{product.name}</td>
                  <td className="py-3 px-4 text-sm">{product.brand || "—"}</td>
                  <td className="py-3 px-4 text-sm">
                    {product.price ? `${product.price.toLocaleString()} ₽` : "—"}
                  </td>
                  <td className="py-3 px-4 text-sm">{product.stock_quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
