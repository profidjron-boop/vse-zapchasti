import Link from "next/link";
import { getServerApiBaseUrl, withApiBase } from "@/lib/api-base-url";

type Category = {
  id: number;
  name: string;
  parent_id: number | null;
};

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

type CatalogSection = {
  category: Category;
  products: Product[];
};

async function getCategories() {
  const apiBaseUrl = getServerApiBaseUrl();
  const res = await fetch(withApiBase(apiBaseUrl, "/api/public/categories"), { cache: "no-store" });
  if (!res.ok) return [];
  return res.json() as Promise<Category[]>;
}

async function getProductsByCategory(categoryId: number) {
  const apiBaseUrl = getServerApiBaseUrl();
  const res = await fetch(
    withApiBase(
      apiBaseUrl,
      `/api/public/products?category_id=${categoryId}&limit=6&in_stock_only=false`
    ),
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  return res.json() as Promise<Product[]>;
}

async function getCatalogSections() {
  const categories = await getCategories();
  if (categories.length === 0) return [];

  const topLevel = categories.filter((category) => category.parent_id === null);
  const targetCategories = (topLevel.length > 0 ? topLevel : categories).slice(0, 6);

  const sections = await Promise.all(
    targetCategories.map(async (category) => ({
      category,
      products: await getProductsByCategory(category.id),
    }))
  );

  return sections.filter((section) => section.products.length > 0) as CatalogSection[];
}

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
  const catalogSections = query ? [] : await getCatalogSections();

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
            <div className="space-y-6">
              <div>
                <div className="text-sm font-semibold text-[#1F3B73]">Начните с поиска</div>
                <div className="mt-1 text-sm text-neutral-600">
                  Введите артикул/OEM или название — покажем результаты.
                </div>
              </div>

              {catalogSections.length === 0 ? (
                <>
                  <div className="text-sm font-semibold text-[#1F3B73]">Каталог временно недоступен</div>
                  <div className="mt-1 text-sm text-neutral-600">
                    Не удалось загрузить категории и товары. Попробуйте поиск по артикулу или VIN-подбор.
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="text-sm font-semibold text-[#1F3B73]">
                    Категории и доступные товары
                  </div>
                  {catalogSections.map((section) => (
                    <div key={section.category.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <h2 className="text-base font-semibold text-[#1F3B73]">{section.category.name}</h2>
                      <div className="mt-3 grid gap-3">
                        {section.products.map((product) => (
                          <article key={product.id} className="rounded-xl border border-white bg-white p-3">
                            <Link href={`/parts/p/${encodeURIComponent(product.sku)}`} className="text-sm font-medium text-[#1F3B73] hover:underline">
                              {product.name}
                            </Link>
                            <div className="mt-1 text-xs text-neutral-600">
                              {product.price ? `${product.price.toLocaleString()} ₽` : "Цена по запросу"}
                              {" · "}
                              {product.stock_quantity > 0 ? "в наличии" : "под заказ"}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : products.length === 0 ? (
            <>
              <div className="text-sm font-semibold text-[#1F3B73]">Ничего не найдено</div>
              <div className="mt-1 text-sm text-neutral-600">
                По запросу <span className="font-medium text-[#1F3B73]">&quot;{query}&quot;</span> ничего не найдено. Оставьте VIN-заявку — мы подберём запчасти вручную.
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
                      <div className="mt-2 text-sm text-neutral-600">
                        Наличие:{" "}
                        <span className={product.stock_quantity > 0 ? "font-semibold text-green-700" : "font-semibold text-amber-700"}>
                          {product.stock_quantity > 0 ? "в наличии" : "под заказ"}
                        </span>
                      </div>
                      <div className="mt-2 text-lg font-semibold text-[#FF7A00]">
                        {product.price ? `${product.price.toLocaleString()} ₽` : "Цена по запросу"}
                      </div>
                    </div>
                    <Link
                      href={`/parts/p/${encodeURIComponent(product.sku)}`}
                      className="rounded-xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#14294F]"
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
