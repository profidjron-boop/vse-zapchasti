import Link from "next/link";
import type { Metadata } from "next";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { PublicFooter } from "@/components/public-footer";
import { getServerApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { PublicHeader } from "@/components/public-header";
import { SmartProductImage } from "@/components/smart-product-image";
import {
  fetchPublicContentMapServer,
  getPublicContentValue,
  getPublicSiteContent,
} from "@/lib/public-site-content";

export const metadata: Metadata = {
  title: "Каталог запчастей | АвтоПлатформа",
  description:
    "Каталог запчастей: поиск по артикулу, OEM и названию, подбор по авто и VIN-заявка.",
};

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
  attributes?: Record<string, unknown>;
  images?: Array<{
    url: string;
    is_main: boolean;
    sort_order: number;
  }>;
};

function isTechnicalCategoryName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized.startsWith("бренд:") || normalized.startsWith("импорт ");
}

async function getCategories(): Promise<Category[] | null> {
  try {
    const apiBaseUrl = getServerApiBaseUrl();
    const res = await fetch(withApiBase(apiBaseUrl, "/api/public/categories"), {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<Category[]>;
  } catch {
    return null;
  }
}

async function getProductsByCategory(
  categoryId: number,
  limit = 24,
  offset = 0,
): Promise<Product[] | null> {
  try {
    const apiBaseUrl = getServerApiBaseUrl();
    const res = await fetch(
      withApiBase(
        apiBaseUrl,
        `/api/public/products?category_id=${categoryId}&limit=${limit}&offset=${offset}&in_stock_only=false`,
      ),
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return res.json() as Promise<Product[]>;
  } catch {
    return null;
  }
}

async function searchProducts(
  query: string,
  filters: {
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleYear?: string;
    vehicleEngine?: string;
  },
) {
  const hasVehicleFilters = Boolean(
    filters.vehicleMake ||
    filters.vehicleModel ||
    filters.vehicleYear ||
    filters.vehicleEngine,
  );
  if (!query && !hasVehicleFilters) return [];

  try {
    const apiBaseUrl = getServerApiBaseUrl();
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (filters.vehicleMake) params.set("vehicle_make", filters.vehicleMake);
    if (filters.vehicleModel) params.set("vehicle_model", filters.vehicleModel);
    if (filters.vehicleYear) params.set("vehicle_year", filters.vehicleYear);
    if (filters.vehicleEngine)
      params.set("vehicle_engine", filters.vehicleEngine);
    params.set("limit", "12");

    const res = await fetch(
      withApiBase(apiBaseUrl, `/api/public/products?${params.toString()}`),
      { cache: "no-store" },
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

function getNumericAttribute(
  attributes: Record<string, unknown> | undefined,
  key: string,
): number | null {
  if (!attributes) return null;
  const value = attributes[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getStringAttribute(
  attributes: Record<string, unknown> | undefined,
  key: string,
): string | null {
  if (!attributes) return null;
  const value = attributes[key];
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function isPriceOnRequest(
  attributes: Record<string, unknown> | undefined,
  price: number | null,
): boolean {
  if (price === null) return true;
  return attributes?.price_on_request === true;
}

function formatPriceLabel(
  attributes: Record<string, unknown> | undefined,
  price: number | null,
): string {
  if (typeof price === "number" && !isPriceOnRequest(attributes, price)) {
    return `${price.toLocaleString("ru-RU")} ₽`;
  }
  return "Цена по запросу";
}

function getProductDisplayName(product: Product): string {
  const description = (product.description ?? "").trim();
  if (description) {
    return description;
  }
  return product.name;
}

function categoryMonogram(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "VP";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function categoryTone(index: number): string {
  const tones = [
    "from-[#1F3B73] to-[#365CAD]",
    "from-[#17315E] to-[#365CAD]",
    "from-[#244A8D] to-[#5A7EC6]",
    "from-[#2A4578] to-[#4E73B8]",
  ];
  return tones[index % tones.length] ?? tones[0];
}

export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    direction?: string;
    category?: string;
    page?: string;
    vehicle_make?: string;
    vehicle_model?: string;
    vehicle_year?: string;
    vehicle_engine?: string;
  }>;
}) {
  const contentMap = await fetchPublicContentMapServer();
  const siteContent = getPublicSiteContent(contentMap);
  const contentValue = (key: string, fallback: string): string => {
    return getPublicContentValue(contentMap, key, fallback);
  };

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const direction = params.direction?.trim().toLowerCase() ?? "";
  const selectedDirection =
    direction === "parts" || direction === "oils" ? direction : "";
  const selectedCategoryParam = Number(params.category ?? "");
  const currentPageParam = Number(params.page ?? "1");
  const currentPage =
    Number.isInteger(currentPageParam) && currentPageParam > 0
      ? currentPageParam
      : 1;
  const catalogPageSize = 24;
  const vehicleMake = params.vehicle_make?.trim() ?? "";
  const vehicleModel = params.vehicle_model?.trim() ?? "";
  const vehicleYear = params.vehicle_year?.trim() ?? "";
  const vehicleEngine = params.vehicle_engine?.trim() ?? "";
  const hasVehicleFilters = Boolean(
    vehicleMake || vehicleModel || vehicleYear || vehicleEngine,
  );
  const normalizedQuery = query.replace(/\s+/g, " ").trim();
  const tooShortSearch =
    normalizedQuery.length > 0 &&
    normalizedQuery.length < 2 &&
    !hasVehicleFilters;

  const productsResult =
    (normalizedQuery && !tooShortSearch) || hasVehicleFilters
      ? await searchProducts(normalizedQuery, {
          vehicleMake,
          vehicleModel,
          vehicleYear,
          vehicleEngine,
        })
      : [];
  const products = productsResult ?? [];
  const searchError =
    (normalizedQuery && !tooShortSearch) || hasVehicleFilters
      ? productsResult === null
      : false;

  const categoriesResult =
    normalizedQuery || hasVehicleFilters ? [] : await getCategories();
  const categoriesError =
    normalizedQuery || hasVehicleFilters ? false : categoriesResult === null;
  const catalogCategories = categoriesResult ?? [];
  const visibleCategories = catalogCategories.filter((category) => {
    if (isTechnicalCategoryName(category.name)) return false;
    if (!selectedDirection) return true;
    const name = category.name.toLowerCase();
    const isOilLike =
      name.includes("масл") ||
      name.includes("смаз") ||
      name.includes("жидк") ||
      name.includes("расход") ||
      name.includes("фильтр");
    return selectedDirection === "oils" ? isOilLike : !isOilLike;
  });
  const visibleCategoryIds = new Set(
    visibleCategories.map((category) => category.id),
  );
  const topCategories = visibleCategories.filter(
    (category) =>
      category.parent_id === null ||
      !visibleCategoryIds.has(category.parent_id),
  );
  const selectedCategory =
    visibleCategories.find(
      (category) => category.id === selectedCategoryParam,
    ) ??
    topCategories[0] ??
    visibleCategories[0] ??
    null;
  const activeRootCategory = selectedCategory
    ? selectedCategory.parent_id !== null
      ? (visibleCategories.find(
          (category) => category.id === selectedCategory.parent_id,
        ) ?? selectedCategory)
      : selectedCategory
    : null;
  const rootSubcategories = activeRootCategory
    ? visibleCategories.filter(
        (category) => category.parent_id === activeRootCategory.id,
      )
    : [];
  const activeLeafCategory = selectedCategory
    ? selectedCategory.parent_id === (activeRootCategory?.id ?? null)
      ? selectedCategory
      : rootSubcategories.length === 0
        ? selectedCategory
        : null
    : null;
  const catalogOffset = (currentPage - 1) * catalogPageSize;
  const selectedCategoryProductsResult =
    normalizedQuery || hasVehicleFilters || !activeLeafCategory
      ? []
      : await getProductsByCategory(
          activeLeafCategory.id,
          catalogPageSize + 1,
          catalogOffset,
        );
  const categoryProducts = (selectedCategoryProductsResult ?? []).slice(
    0,
    catalogPageSize,
  );
  const hasNextCategoryPage =
    (selectedCategoryProductsResult?.length ?? 0) > catalogPageSize;
  const hasPrevCategoryPage = currentPage > 1;
  const catalogError =
    categoriesError ||
    (!!activeLeafCategory && selectedCategoryProductsResult === null);

  const heroTitle = contentValue(
    "parts_hero_title",
    "Каталог и подбор запчастей",
  );
  const heroSubtitle = contentValue(
    "parts_hero_subtitle",
    "Ищите по артикулу/OEM, фильтруйте по категории и оставляйте VIN-заявку, если нужен ручной подбор.",
  );
  const searchLabel = contentValue(
    "parts_search_label",
    "Поиск по артикулу или OEM",
  );
  const searchPlaceholder = contentValue(
    "parts_search_placeholder",
    "Например: 06A905161B",
  );
  const shortQueryMessage = contentValue(
    "parts_short_query_message",
    "Для поиска укажите минимум 2 символа: артикул, OEM или часть названия.",
  );
  const footerText = contentValue(
    "site_footer_text",
    siteContent.footerText,
  );

  const buildCatalogHref = (categoryId?: number, page?: number): string => {
    const queryParams = new URLSearchParams();
    if (selectedDirection) {
      queryParams.set("direction", selectedDirection);
    }
    if (categoryId) {
      queryParams.set("category", String(categoryId));
    }
    if (page && page > 1) {
      queryParams.set("page", String(page));
    }
    const queryString = queryParams.toString();
    return queryString ? `/parts?${queryString}` : "/parts";
  };

  const heroDirectionLinks = [
    {
      key: "parts",
      label: "Запчасти для ремонта",
      href: "/parts?direction=parts",
      active: selectedDirection === "parts",
    },
    {
      key: "oils",
      label: "Масла и расходники",
      href: "/parts?direction=oils",
      active: selectedDirection === "oils",
    },
  ];

  const buildProductHref = (sku: string): string => {
    const queryParams = new URLSearchParams();
    if (selectedDirection) {
      queryParams.set("direction", selectedDirection);
    }
    if (!normalizedQuery && !hasVehicleFilters && activeLeafCategory) {
      queryParams.set("category", String(activeLeafCategory.id));
      queryParams.set("category_name", activeLeafCategory.name);
      if (currentPage > 1) {
        queryParams.set("page", String(currentPage));
      }
    }
    const queryString = queryParams.toString();
    const productPath = `/parts/p/${encodeURIComponent(sku)}`;
    return queryString ? `${productPath}?${queryString}` : productPath;
  };

  const renderProductCard = (product: Product) => {
    const productHref = buildProductHref(product.sku);
    const productImageUrl = getMainImageUrl(product);
    return (
      <article
        key={product.id}
        className="group rounded-[1.75rem] border border-neutral-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)] transition-shadow duration-200 hover:shadow-[0_24px_54px_rgba(15,23,42,0.10)]"
      >
        <Link href={productHref} className="block">
          <div className="relative h-44 overflow-hidden rounded-[1.25rem] border border-neutral-200 bg-neutral-100">
            <SmartProductImage
              compact
              src={productImageUrl}
              alt={product.name}
              sku={product.sku}
              name={getProductDisplayName(product)}
              brand={product.brand}
              width={480}
              height={320}
            />
          </div>
        </Link>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={productHref}
              className="line-clamp-2 text-base font-bold leading-6 text-neutral-900 transition-colors group-hover:text-[#1F3B73]"
            >
              {getProductDisplayName(product)}
            </Link>
            <div className="mt-2 text-sm text-neutral-500">
              Артикул: {product.sku}
              {product.oem ? ` · OEM: ${product.oem}` : ""}
            </div>
            {product.brand ? (
              <div className="mt-1 text-sm text-neutral-500">
                Бренд: {product.brand}
              </div>
            ) : null}
          </div>
          {getStringAttribute(product.attributes, "discount_label") ? (
            <span className="shrink-0 rounded-full bg-[#FF7A00]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#FF7A00]">
              {getStringAttribute(product.attributes, "discount_label")}
            </span>
          ) : null}
        </div>

        <div className="mt-4">
          {(() => {
            const oldPrice = getNumericAttribute(
              product.attributes,
              "old_price",
            );
            const requestMode = isPriceOnRequest(
              product.attributes,
              product.price,
            );
            return (
              <>
                {typeof oldPrice === "number" &&
                typeof product.price === "number" &&
                !requestMode &&
                oldPrice > product.price ? (
                  <div className="text-sm text-neutral-400 line-through">
                    {oldPrice.toLocaleString("ru-RU")} ₽
                  </div>
                ) : null}
                <div className="text-2xl font-black tracking-tight text-[#1F3B73]">
                  {formatPriceLabel(product.attributes, product.price)}
                </div>
              </>
            );
          })()}
        </div>

        <div className="mt-2 text-sm text-neutral-600">
          {product.stock_quantity > 0 ? (
            <span className="font-semibold text-emerald-700">В наличии</span>
          ) : (
            <span className="font-semibold text-amber-700">Под заказ</span>
          )}
        </div>

        <div className="mt-5 space-y-2">
          <AddToCartButton
            productId={product.id}
            sku={product.sku}
            name={getProductDisplayName(product)}
            price={
              isPriceOnRequest(product.attributes, product.price)
                ? null
                : product.price
            }
            stabilizeNoticeHeight
            noticeBehavior="overlay"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href={productHref}
              className="inline-flex items-center justify-center rounded-2xl bg-[#1F3B73] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#14294F]"
            >
              Открыть карточку
            </Link>
            <Link
              href={`${productHref}#product-lead-form`}
              className="inline-flex items-center justify-center rounded-2xl border border-[#1F3B73]/15 bg-[#EEF3FF] px-4 py-3 text-sm font-semibold text-[#1F3B73] transition-colors hover:bg-[#E1EAFB]"
            >
              Запросить
            </Link>
          </div>
        </div>
      </article>
    );
  };

  return (
    <main className="min-h-dvh bg-[#F3F5F8] text-neutral-900">
      <PublicHeader
        brandName={siteContent.brandName}
        activeKey="parts"
        labels={siteContent.labels}
      />

      <section className="border-b border-neutral-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef3fb_100%)]">
        <div className="mx-auto grid max-w-[92rem] gap-5 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(21rem,0.8fr)] lg:gap-6 lg:py-14">
          <div className="rounded-[2rem] bg-[linear-gradient(135deg,#1F3B73_0%,#17315E_65%,#10264B_100%)] p-6 text-white shadow-[0_30px_80px_rgba(31,59,115,0.18)] sm:p-8">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              catalog · sku · vin
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:mt-5 sm:text-5xl">
              {heroTitle}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78 sm:mt-4 sm:text-lg sm:leading-7">
              {heroSubtitle}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
              {heroDirectionLinks.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${
                    item.active
                      ? "bg-white text-[#1F3B73]"
                      : "border border-white/15 bg-white/10 text-white hover:bg-white/16"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-8 hidden gap-3 sm:grid sm:grid-cols-3">
              {[
                "Поиск по SKU и OEM без регистрации.",
                "VIN-заявка для ручного подбора.",
                "Переход в карточку, заявку или корзину.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/8 p-4 text-sm leading-6 text-white/76"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <form
              id="parts-search"
              action="/parts"
              method="get"
              className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-6"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
                поиск по каталогу
              </div>
              <label
                htmlFor="catalog-query"
                className="mt-3 block text-sm font-semibold text-neutral-900"
              >
                {searchLabel}
              </label>
              {selectedDirection ? (
                <input
                  type="hidden"
                  name="direction"
                  value={selectedDirection}
                />
              ) : null}
              <input
                id="catalog-query"
                name="q"
                defaultValue={query}
                placeholder={searchPlaceholder}
                className="mt-3 h-12 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  name="vehicle_make"
                  defaultValue={vehicleMake}
                  placeholder="Марка"
                  className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                />
                <input
                  name="vehicle_model"
                  defaultValue={vehicleModel}
                  placeholder="Модель"
                  className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                />
                <input
                  name="vehicle_year"
                  defaultValue={vehicleYear}
                  placeholder="Год"
                  inputMode="numeric"
                  className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                />
                <input
                  name="vehicle_engine"
                  defaultValue={vehicleEngine}
                  placeholder="Двигатель"
                  className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#1F3B73]/30 focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-[#FF7A00] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#E86F00]"
              >
                Найти товары
              </button>
            </form>

            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <Link
                href="/parts/vin"
                className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-colors hover:border-[#1F3B73]/15 hover:bg-[#F8FBFF]"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F3B73]">
                  VIN
                </div>
                <div className="mt-3 text-lg font-bold text-neutral-900">
                  Оставить VIN-заявку
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Для случаев, когда нужен ручной подбор по автомобилю.
                </p>
              </Link>
              <Link
                href="/service#form"
                className="rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition-colors hover:border-[#1F3B73]/15 hover:bg-[#F8FBFF]"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1F3B73]">
                  сервис
                </div>
                <div className="mt-3 text-lg font-bold text-neutral-900">
                  Записаться на ремонт
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  Диагностика, ТО и сервис для легковых и коммерческих
                  автомобилей.
                </p>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[92rem] px-4 py-12 sm:px-6">
        {!normalizedQuery && !hasVehicleFilters ? (
          <>
            {catalogError ? (
              <div className="rounded-[2rem] border border-neutral-200 bg-white p-8 text-sm text-neutral-600 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
                Каталог временно недоступен. Попробуйте поиск по артикулу или
                VIN-подбор.
              </div>
            ) : topCategories.length === 0 ? (
              <div className="rounded-[2rem] border border-neutral-200 bg-white p-8 text-sm text-neutral-600 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
                Категории пока не опубликованы. Загрузите товары через админку
                или используйте поиск по артикулу.
              </div>
            ) : !activeRootCategory ? (
              <div className="rounded-[2rem] border border-neutral-200 bg-white p-8 text-sm text-neutral-600 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
                Не удалось определить активную категорию. Откройте каталог
                заново.
              </div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
                <aside className="space-y-4 xl:self-start">
                  <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
                      категории
                    </div>
                    <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#10264B]">
                      Разделы каталога
                    </h2>
                    <p className="mt-2 text-xs text-neutral-500">
                      Разделов: {topCategories.length}.
                    </p>
                    <div className="mt-5 flex gap-2 overflow-x-auto pb-1 xl:block xl:space-y-2">
                      {topCategories.map((category, index) => (
                        <Link
                          key={category.id}
                          href={buildCatalogHref(category.id, 1)}
                          className={`flex w-[15rem] shrink-0 items-center gap-3 rounded-2xl px-3 py-3 transition-colors xl:w-auto ${
                            category.id === activeRootCategory.id
                              ? "bg-[#EEF3FF] text-[#1F3B73]"
                              : "border border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
                          }`}
                        >
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${categoryTone(index)} text-sm font-black text-white`}
                          >
                            {categoryMonogram(category.name)}
                          </div>
                          <span className="text-sm font-medium leading-5">
                            {category.name}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </aside>

                <section className="space-y-5">
                  <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
                          активная категория
                        </div>
                        <h2 className="mt-2 text-3xl font-black tracking-tight text-[#10264B]">
                          {activeRootCategory.name}
                        </h2>
                      </div>
                      <div className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-600">
                        {activeLeafCategory
                          ? `Страница ${currentPage}`
                          : "Выберите подкатегорию"}
                      </div>
                    </div>

                    {rootSubcategories.length > 0 ? (
                      <div className="mt-5">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
                          подкатегории
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {rootSubcategories.map((subcategory) => (
                            <Link
                              key={subcategory.id}
                              href={buildCatalogHref(subcategory.id, 1)}
                              className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                                activeLeafCategory?.id === subcategory.id
                                  ? "bg-[#EEF3FF] text-[#1F3B73]"
                                  : "border border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
                              }`}
                            >
                              {subcategory.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {!activeLeafCategory ? (
                    <div className="rounded-[2rem] border border-neutral-200 bg-white p-8 text-sm text-neutral-600 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
                      Выберите подкатегорию, чтобы открыть товары и перейти к
                      карточкам.
                    </div>
                  ) : categoryProducts.length === 0 ? (
                    <div className="rounded-[2rem] border border-neutral-200 bg-white p-8 text-sm text-neutral-600 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
                      В выбранной категории пока нет активных товаров.
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {categoryProducts.map(renderProductCard)}
                    </div>
                  )}

                  {activeLeafCategory ? (
                    <div className="flex flex-wrap items-center gap-3">
                      {hasPrevCategoryPage ? (
                        <Link
                          href={buildCatalogHref(
                            activeLeafCategory.id,
                            currentPage - 1,
                          )}
                          className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                        >
                          ← Предыдущая страница
                        </Link>
                      ) : (
                        <span className="inline-flex items-center justify-center rounded-2xl border border-neutral-100 bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-400">
                          ← Предыдущая страница
                        </span>
                      )}
                      {hasNextCategoryPage ? (
                        <Link
                          href={buildCatalogHref(
                            activeLeafCategory.id,
                            currentPage + 1,
                          )}
                          className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                        >
                          Следующая страница →
                        </Link>
                      ) : (
                        <span className="inline-flex items-center justify-center rounded-2xl border border-neutral-100 bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-400">
                          Следующая страница →
                        </span>
                      )}
                    </div>
                  ) : null}
                </section>
              </div>
            )}
          </>
        ) : tooShortSearch ? (
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-8 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
            <div className="text-sm font-semibold text-[#1F3B73]">
              Слишком короткий запрос
            </div>
            <div className="mt-2 text-sm leading-6 text-neutral-600">
              {shortQueryMessage}
            </div>
          </div>
        ) : searchError ? (
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-8 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
            <div className="text-sm font-semibold text-[#1F3B73]">
              Ошибка поиска
            </div>
            <div className="mt-2 text-sm leading-6 text-neutral-600">
              Не удалось загрузить результаты по запросу{" "}
              <span className="font-medium text-[#1F3B73]">
                &quot;{normalizedQuery}&quot;
              </span>
              . Попробуйте повторить позже.
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-8 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
            <div className="text-sm font-semibold text-[#1F3B73]">
              Ничего не найдено
            </div>
            <div className="mt-2 text-sm leading-6 text-neutral-600">
              По запросу{" "}
              <span className="font-medium text-[#1F3B73]">
                &quot;{normalizedQuery}&quot;
              </span>{" "}
              результатов нет. Для сложного подбора оставьте VIN-заявку.
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/parts/vin"
                className="inline-flex items-center justify-center rounded-2xl bg-[#FF7A00] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#E86F00]"
              >
                Оставить VIN-заявку
              </Link>
              <Link
                href="/parts"
                className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                Сбросить поиск
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
                    результаты поиска
                  </div>
                  <h2 className="mt-2 text-3xl font-black tracking-tight text-[#10264B]">
                    Найдено {products.length} товаров
                  </h2>
                </div>
                <div className="text-sm text-neutral-500">
                  {hasVehicleFilters
                    ? "С учётом параметров автомобиля"
                    : "По артикулу, OEM или названию"}
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {products.map(renderProductCard)}
            </div>
          </div>
        )}
      </section>

      <PublicFooter
        brandName={siteContent.brandName}
        footerText={footerText}
        contactsLabel={siteContent.labels.contacts}
      />
    </main>
  );
}
