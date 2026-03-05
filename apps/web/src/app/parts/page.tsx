import Link from "next/link";
import { getServerApiBaseUrl, withApiBase } from "@/lib/api-base-url";
type Product = {
  id: number;
  name: string;
  sku: string;
  oem: string | null;
  brand: string | null;
  price: number | null;
  description: string | null;
  stock_quantity: number;
};

async function searchProducts(query: string) {
  if (!query) return [];
  
  const apiBaseUrl = getServerApiBaseUrl();
  const res = await fetch(
    withApiBase(apiBaseUrl, `/api/public/products?search=${encodeURIComponent(query)}&limit=10`),
    { cache: 'no-store' }
  );
  
  if (!res.ok) return [];
  return res.json();
}

export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const products = query ? await searchProducts(query) : [];

  return (
    <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-[#1F3B73]">Все запчасти</Link>
            <nav className="hidden items-center gap-8 md:flex">
              <Link href="/parts" className="text-sm font-medium text-[#1F3B73] border-b-2 border-[#1F3B73] pb-1">Запчасти</Link>
              <Link href="/service" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Автосервис</Link>
              <Link href="/contacts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Контакты</Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#1F3B73]/20 bg-[#1F3B73]/5 px-3 py-1 text-xs font-medium text-[#1F3B73]">
            Запчасти · Поиск · Подбор
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1F3B73] sm:text-4xl">
            Подбор запчастей
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-neutral-600">
            Ищите по артикулу/OEM или названию. Если не уверены — оставьте VIN-заявку, менеджер подберёт совместимость.
          </p>
        </div>

        <form action="/parts" method="get" className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-lg">
          <label className="block text-sm font-semibold text-neutral-700">
            Поиск по артикулу или OEM
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              name="q"
              defaultValue={query}
              placeholder="Например: 06A905161B"
              className="h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-neutral-900 focus:border-[#1F3B73] focus:outline-none"
            />
            <button
              type="submit"
              className="h-12 shrink-0 rounded-2xl bg-[#1F3B73] px-6 text-sm font-medium text-white transition hover:bg-[#14294F]"
            >
              Найти
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/parts/vin"
              className="text-sm font-medium text-[#FF7A00] hover:underline"
            >
              Оставить VIN-заявку →
            </Link>
            <div className="text-xs text-neutral-500">
              Красноярск · Ответ менеджера в рабочее время
            </div>
          </div>
        </form>

        <div className="mt-8 rounded-3xl border border-neutral-200 bg-white p-6">
          {query === "" ? (
            <>
              <div className="text-sm font-semibold text-[#1F3B73]">Начните с поиска</div>
              <div className="mt-1 text-sm text-neutral-600">
                Введите артикул/OEM или название — покажем результаты.
              </div>
            </>
          ) : products.length === 0 ? (
            <>
              <div className="text-sm font-semibold text-[#1F3B73]">Ничего не найдено</div>
              <div className="mt-1 text-sm text-neutral-600">
                По запросу <span className="font-medium text-[#1F3B73]">&quot;{query}&quot;</span> ничего не найдено. Оставьте VIN-заявку — мы подберём запчасти вручную.
                Оставьте VIN-заявку — мы подберём запчасти вручную.
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/parts/vin"
                  className="rounded-2xl bg-[#FF7A00] px-4 py-2 text-sm font-medium text-white hover:bg-[#e66e00]"
                >
                  Оставить VIN-заявку
                </Link>
                <Link
                  href="/"
                  className="rounded-2xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
                >
                  На главную
                </Link>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-[#1F3B73]">
                  Найдено {products.length} товаров
                </div>
              </div>
              <div className="grid gap-4">
                {products.map((product: Product) => (
                  <div key={product.id} className="flex items-start justify-between rounded-2xl border border-neutral-200 p-4 hover:shadow-md transition">
                    <div>
                      <div className="font-medium text-[#1F3B73]">{product.name}</div>
                      <div className="mt-1 text-sm text-neutral-600">
                        Артикул: {product.sku} | OEM: {product.oem || "—"} | Бренд: {product.brand || "—"}
                      </div>
                      {product.price && (
                        <div className="mt-2 text-lg font-semibold text-[#FF7A00]">
                          {product.price.toLocaleString()} ₽
                        </div>
                      )}
                    </div>
                    <Link
                      href={`/parts/${product.id}`}
                      className="rounded-xl bg-[#1F3B73] px-4 py-2 text-sm text-white hover:bg-[#14294F] transition"
                    >
                      Подробнее
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-neutral-200 bg-neutral-50 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-neutral-600">
          © {new Date().getFullYear()} Все запчасти · Красноярск · NO CDN
        </div>
      </footer>
    </main>
  );
}
