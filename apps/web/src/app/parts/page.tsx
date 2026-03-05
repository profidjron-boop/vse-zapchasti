import Image from "next/image";
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
  images?: Array<{
    url: string;
    is_main: boolean;
    sort_order: number;
  }>;
};

type CatalogSection = {
  category: Category;
  products: Product[];
};

async function getPublicContentMap(): Promise<Record<string, string>> {
  try {
    const apiBaseUrl = getServerApiBaseUrl();
    const response = await fetch(withApiBase(apiBaseUrl, "/api/public/content"), { cache: "no-store" });
    if (!response.ok) return {};
    const payload = (await response.json()) as Array<{ key?: string; value?: string | null }>;
    if (!Array.isArray(payload)) return {};

    const map: Record<string, string> = {};
    for (const item of payload) {
      if (item?.key && typeof item.value === "string") {
        map[item.key] = item.value;
      }
    }
    return map;
  } catch {
    return {};
  }
}

async function getCategories(): Promise<Category[] | null> {
  try {
    const apiBaseUrl = getServerApiBaseUrl();
    const res = await fetch(withApiBase(apiBaseUrl, "/api/public/categories"), { cache: "no-store" });
    if (!res.ok) return null;
    return res.json() as Promise<Category[]>;
  } catch {
    return null;
  }
}

async function getProductsByCategory(categoryId: number): Promise<Product[] | null> {
  try {
    const apiBaseUrl = getServerApiBaseUrl();
    const res = await fetch(
      withApiBase(
        apiBaseUrl,
        `/api/public/products?category_id=${categoryId}&limit=6&in_stock_only=false`
      ),
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json() as Promise<Product[]>;
  } catch {
    return null;
  }
}

async function getCatalogSections() {
  const categories = await getCategories();
  if (!categories) return { sections: [] as CatalogSection[], hasError: true };
  if (categories.length === 0) return { sections: [] as CatalogSection[], hasError: false };

  const topLevel = categories.filter((category) => category.parent_id === null);
  const targetCategories = (topLevel.length > 0 ? topLevel : categories).slice(0, 6);

  let hasError = false;
  const sections = await Promise.all(
    targetCategories.map(async (category) => {
      const products = await getProductsByCategory(category.id);
      if (!products) {
        hasError = true;
      }
      return {
        category,
        products: products ?? [],
      };
    })
  );

  return {
    sections: sections.filter((section) => section.products.length > 0) as CatalogSection[],
    hasError,
  };
}

async function searchProducts(query: string) {
  if (!query) return [];

  try {
    const apiBaseUrl = getServerApiBaseUrl();
    const res = await fetch(
      withApiBase(apiBaseUrl, `/api/public/products?search=${encodeURIComponent(query)}&limit=10`),
      { cache: "no-store" }
    );

    if (!res.ok) return null;
    return (await res.json()) as Product[];
  } catch {
    return null;
  }
}

function getMainImageUrl(product: Product): string | null {
  const images = product.images ?? [];
  if (images.length === 0) return null;
  const main = images.find((image) => image.is_main) ?? images[0];
  return main?.url || null;
}

export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const contentMap = await getPublicContentMap();
  const contentValue = (key: string, fallback: string): string => {
    const value = contentMap[key];
    return value && value.trim() ? value : fallback;
  };

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const normalizedQuery = query.replace(/\s+/g, " ").trim();
  const tooShortSearch = normalizedQuery.length > 0 && normalizedQuery.length < 2;
  const productsResult = normalizedQuery && !tooShortSearch ? await searchProducts(normalizedQuery) : [];
  const products = productsResult ?? [];
  const searchError = normalizedQuery && !tooShortSearch ? productsResult === null : false;

  const catalogResult = normalizedQuery ? { sections: [] as CatalogSection[], hasError: false } : await getCatalogSections();
  const catalogSections = catalogResult.sections;
  const catalogError = catalogResult.hasError;
  const brandName = contentValue("site_brand_name", "Все запчасти");
  const navParts = contentValue("site_nav_parts_label", "Запчасти");
  const navService = contentValue("site_nav_service_label", "Автосервис");
  const navContacts = contentValue("site_nav_contacts_label", "Контакты");
  const navFavorites = contentValue("site_nav_favorites_label", "Избранное");
  const navOrders = contentValue("site_nav_orders_label", "Мои заказы");
  const heroTitle = contentValue("parts_hero_title", "Подбор запчастей");
  const heroSubtitle = contentValue(
    "parts_hero_subtitle",
    "Ищите по артикулу/OEM или названию. Если не уверены — оставьте VIN-заявку, менеджер подберёт совместимость."
  );
  const searchLabel = contentValue("parts_search_label", "Поиск по артикулу или OEM");
  const searchPlaceholder = contentValue("parts_search_placeholder", "Например: 06A905161B");
  const shortQueryMessage = contentValue(
    "parts_short_query_message",
    "Для поиска укажите минимум 2 символа (например, артикул, OEM или часть названия)."
  );
  const footerText = contentValue("site_footer_text", "Все запчасти · Красноярск · NO CDN");

  return (
    <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-[#1F3B73]">{brandName}</Link>
            <nav className="hidden items-center gap-8 md:flex">
              <Link href="/parts" className="text-sm font-medium text-[#1F3B73] border-b-2 border-[#1F3B73] pb-1">{navParts}</Link>
              <Link href="/service" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">{navService}</Link>
              <Link href="/contacts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">{navContacts}</Link>
              <Link href="/favorites" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">{navFavorites}</Link>
              <Link href="/cart" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Корзина</Link>
              <Link href="/account/orders" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">{navOrders}</Link>
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
            {heroTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-neutral-600">
            {heroSubtitle}
          </p>
        </div>

        <form action="/parts" method="get" className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-lg">
          <label className="block text-sm font-semibold text-neutral-700">
            {searchLabel}
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              name="q"
              defaultValue={query}
              placeholder={searchPlaceholder}
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
          {normalizedQuery === "" ? (
            <div className="space-y-6">
              <div>
                <div className="text-sm font-semibold text-[#1F3B73]">Начните с поиска</div>
                <div className="mt-1 text-sm text-neutral-600">
                  Введите артикул/OEM или название — покажем результаты.
                </div>
              </div>

              {catalogError && catalogSections.length === 0 ? (
                <>
                  <div className="text-sm font-semibold text-[#1F3B73]">Каталог временно недоступен</div>
                  <div className="mt-1 text-sm text-neutral-600">
                    Не удалось загрузить категории и товары. Попробуйте поиск по артикулу или VIN-подбор.
                  </div>
                </>
              ) : catalogSections.length === 0 ? (
                <>
                  <div className="text-sm font-semibold text-[#1F3B73]">Каталог пока пуст</div>
                  <div className="mt-1 text-sm text-neutral-600">
                    Товары появятся здесь после публикации в админке.
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
                            <div className="flex items-start gap-3">
                              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
                                {getMainImageUrl(product) ? (
                                  <Image
                                    src={getMainImageUrl(product) as string}
                                    alt={product.name}
                                    className="h-full w-full object-cover"
                                    width={64}
                                    height={64}
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-[10px] text-neutral-400">NO IMAGE</div>
                                )}
                              </div>
                              <div>
                                <Link href={`/parts/p/${encodeURIComponent(product.sku)}`} className="text-sm font-medium text-[#1F3B73] hover:underline">
                                  {product.name}
                                </Link>
                                <div className="mt-1 text-xs text-neutral-600">
                                  {product.price ? `${product.price.toLocaleString()} ₽` : "Цена по запросу"}
                                  {" · "}
                                  {product.stock_quantity > 0 ? "в наличии" : "под заказ"}
                                  {" · "}
                                  {product.brand || "без бренда"}
                                </div>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : tooShortSearch ? (
            <>
              <div className="text-sm font-semibold text-[#1F3B73]">Слишком короткий запрос</div>
              <div className="mt-1 text-sm text-neutral-600">
                {shortQueryMessage}
              </div>
            </>
          ) : searchError ? (
            <>
              <div className="text-sm font-semibold text-[#1F3B73]">Ошибка поиска</div>
              <div className="mt-1 text-sm text-neutral-600">
                Не удалось загрузить результаты по запросу{" "}
                <span className="font-medium text-[#1F3B73]">&quot;{normalizedQuery}&quot;</span>. Попробуйте повторить позже.
              </div>
            </>
          ) : products.length === 0 ? (
            <>
              <div className="text-sm font-semibold text-[#1F3B73]">Ничего не найдено</div>
              <div className="mt-1 text-sm text-neutral-600">
                По запросу <span className="font-medium text-[#1F3B73]">&quot;{normalizedQuery}&quot;</span> ничего не найдено. Оставьте VIN-заявку — мы подберём запчасти вручную.
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
                  <div key={product.id} className="flex items-start justify-between gap-4 rounded-2xl border border-neutral-200 p-4 hover:shadow-md transition">
                    <div className="flex items-start gap-4">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
                        {getMainImageUrl(product) ? (
                          <Image
                            src={getMainImageUrl(product) as string}
                            alt={product.name}
                            className="h-full w-full object-cover"
                            width={80}
                            height={80}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-neutral-400">NO IMAGE</div>
                        )}
                      </div>
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
          © {new Date().getFullYear()} {footerText}
        </div>
      </footer>
    </main>
  );
}
