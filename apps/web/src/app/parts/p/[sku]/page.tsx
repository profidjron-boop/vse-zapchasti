import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { getServerApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { PublicHeader } from "@/components/public-header";
import { SmartProductImage } from "@/components/smart-product-image";
import ProductLeadForm from "./product-lead-form";
import FavoriteToggleButton from "./favorite-toggle-button";

type Product = {
  id: number;
  category_id: number;
  sku: string;
  oem: string | null;
  brand: string | null;
  name: string;
  description: string | null;
  price: number | null;
  stock_quantity: number;
  is_active: boolean;
  attributes?: Record<string, unknown>;
  compatibilities?: Array<{
    id?: number;
    make: string;
    model: string;
    year_from?: number | null;
    year_to?: number | null;
    engine?: string | null;
  }>;
  images?: Array<{
    url: string;
    is_main: boolean;
    sort_order: number;
  }>;
};

async function getProductBySku(
  sku: string,
): Promise<{ product: Product | null; hasError: boolean }> {
  try {
    const apiBaseUrl = getServerApiBaseUrl();
    const response = await fetch(
      withApiBase(
        apiBaseUrl,
        `/api/public/products/by-sku/${encodeURIComponent(sku)}`,
      ),
      { cache: "no-store" },
    );

    if (response.status === 404) {
      return { product: null, hasError: false };
    }
    if (!response.ok) {
      return { product: null, hasError: true };
    }

    return { product: (await response.json()) as Product, hasError: false };
  } catch {
    return { product: null, hasError: true };
  }
}

async function getCategoryNameById(categoryId: number): Promise<string | null> {
  if (!Number.isInteger(categoryId) || categoryId <= 0) return null;

  try {
    const apiBaseUrl = getServerApiBaseUrl();
    const response = await fetch(
      withApiBase(apiBaseUrl, `/api/public/categories?active_only=false`),
      { cache: "no-store" },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as Array<{
      id?: number;
      name?: string;
    }>;
    if (!Array.isArray(payload)) return null;

    const category = payload.find((item) => item?.id === categoryId);
    const name = category?.name?.trim();
    return name || null;
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

function getStringListAttribute(
  attributes: Record<string, unknown> | undefined,
  keys: string[],
): string[] {
  if (!attributes) return [];

  for (const key of keys) {
    const value = attributes[key];
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sku: string }>;
}): Promise<Metadata> {
  const routeParams = await params;
  const sku = routeParams.sku?.trim();
  if (!sku) {
    return {
      title: "Товар | Все запчасти",
    };
  }

  const { product } = await getProductBySku(sku);
  if (!product) {
    return {
      title: "Товар не найден | Все запчасти",
      description: "Карточка товара недоступна или отсутствует в каталоге.",
    };
  }

  const baseDescription =
    product.description?.trim() ||
    `${product.name}. Артикул: ${product.sku}${product.brand ? `, бренд: ${product.brand}` : ""}.`;
  const mainImageUrl = getMainImageUrl(product);
  const canonicalPath = `/parts/p/${encodeURIComponent(product.sku)}`;

  return {
    title: `${product.name} | Все запчасти`,
    description: baseDescription.slice(0, 160),
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: `${product.name} | Все запчасти`,
      description: baseDescription.slice(0, 160),
      type: "website",
      url: canonicalPath,
      images: mainImageUrl
        ? [
            {
              url: mainImageUrl,
              alt: product.name,
            },
          ]
        : undefined,
    },
  };
}

export default async function ProductBySkuPage({
  params,
  searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams: Promise<{
    direction?: string;
    category?: string;
    category_name?: string;
    page?: string;
  }>;
}) {
  const routeParams = await params;
  const queryParams = await searchParams;
  const sku = routeParams.sku?.trim();
  if (!sku) {
    notFound();
  }

  const directionParam = (queryParams.direction || "").trim().toLowerCase();
  const categoryParam = Number.parseInt(queryParams.category || "", 10);
  const categoryNameParam = (queryParams.category_name || "").trim();
  const pageParam = Number.parseInt(queryParams.page || "", 10);
  const normalizedCategoryName = categoryNameParam
    .replace(/\s+/g, " ")
    .slice(0, 120);
  const catalogRootParams = new URLSearchParams();
  if (directionParam === "parts" || directionParam === "oils") {
    catalogRootParams.set("direction", directionParam);
  }
  const catalogRootHref = catalogRootParams.toString()
    ? `/parts?${catalogRootParams.toString()}`
    : "/parts";
  const backToCatalogParams = new URLSearchParams();
  if (directionParam === "parts" || directionParam === "oils") {
    backToCatalogParams.set("direction", directionParam);
  }
  if (Number.isInteger(categoryParam) && categoryParam > 0) {
    backToCatalogParams.set("category", String(categoryParam));
  }
  if (Number.isInteger(pageParam) && pageParam > 1) {
    backToCatalogParams.set("page", String(pageParam));
  }
  const backToCatalogHref = backToCatalogParams.toString()
    ? `/parts?${backToCatalogParams.toString()}`
    : "/parts";

  const { product, hasError } = await getProductBySku(sku);
  if (!product && !hasError) {
    notFound();
  }
  if (!product && hasError) {
    return (
      <main className="min-h-dvh bg-[#F3F5F8] text-neutral-900">
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-8 text-center shadow-[0_20px_55px_rgba(15,23,42,0.08)]">
            <h1 className="text-xl font-semibold text-[#1F3B73]">
              Товар временно недоступен
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Не удалось загрузить карточку товара. Повторите попытку чуть
              позже.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href={backToCatalogHref}
                className="rounded-2xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#14294F]"
              >
                Вернуться в каталог
              </Link>
              <Link
                href="/parts/vin"
                className="rounded-2xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                Оставить VIN-заявку
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const currentProduct = product as Product;
  const mainImageUrl = getMainImageUrl(currentProduct);
  const oldPrice = getNumericAttribute(currentProduct.attributes, "old_price");
  const discountLabel =
    getStringAttribute(currentProduct.attributes, "discount_label") ||
    getStringAttribute(currentProduct.attributes, "sale_badge");
  const analogs = getStringListAttribute(currentProduct.attributes, [
    "analogs",
    "crosses",
    "cross_codes",
  ]);
  const compatibilities = currentProduct.compatibilities ?? [];
  const requestMode = isPriceOnRequest(
    currentProduct.attributes,
    currentProduct.price,
  );
  const effectivePrice = requestMode ? null : currentProduct.price;
  const resolvedCategoryId =
    Number.isInteger(categoryParam) && categoryParam > 0
      ? categoryParam
      : currentProduct.category_id;
  const resolvedCategoryName =
    normalizedCategoryName ||
    (resolvedCategoryId > 0
      ? await getCategoryNameById(resolvedCategoryId)
      : null);
  const productBackToCatalogParams = new URLSearchParams();
  if (directionParam === "parts" || directionParam === "oils") {
    productBackToCatalogParams.set("direction", directionParam);
  }
  if (Number.isInteger(resolvedCategoryId) && resolvedCategoryId > 0) {
    productBackToCatalogParams.set("category", String(resolvedCategoryId));
  }
  if (Number.isInteger(pageParam) && pageParam > 1) {
    productBackToCatalogParams.set("page", String(pageParam));
  }
  const productBackToCatalogHref = productBackToCatalogParams.toString()
    ? `/parts?${productBackToCatalogParams.toString()}`
    : "/parts";
  const installRequestParams = new URLSearchParams({
    install_with_part: "1",
    product_sku: currentProduct.sku,
    product_name: currentProduct.name,
  });
  if (effectivePrice !== null) {
    installRequestParams.set("bundle_total", String(effectivePrice));
  }
  const installRequestHref = `/service?${installRequestParams.toString()}#form`;

  return (
    <main className="min-h-dvh bg-[#F3F5F8] text-neutral-900">
      <PublicHeader activeKey="parts" />

      <section className="border-b border-neutral-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef3fb_100%)]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            <Link href="/" className="transition-colors hover:text-[#1F3B73]">
              Главная
            </Link>
            <span>/</span>
            <Link
              href={catalogRootHref}
              className="transition-colors hover:text-[#1F3B73]"
            >
              Каталог
            </Link>
            {resolvedCategoryName ? (
              <>
                <span>/</span>
                <Link
                  href={productBackToCatalogHref}
                  className="transition-colors hover:text-[#1F3B73]"
                >
                  {resolvedCategoryName}
                </Link>
              </>
            ) : null}
            <span>/</span>
            <span className="text-neutral-700">{currentProduct.sku}</span>
          </div>
          <div className="mt-3">
            <Link
              href={productBackToCatalogHref}
              className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-600 transition-colors hover:border-[#1F3B73]/20 hover:text-[#1F3B73]"
            >
              ← К разделу каталога
            </Link>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,26rem)]">
            <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_20px_55px_rgba(15,23,42,0.06)] lg:p-8">
              <div className="grid gap-6 xl:grid-cols-[minmax(21rem,26rem)_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-[1.75rem] border border-neutral-200 bg-neutral-100">
                  <SmartProductImage
                    src={mainImageUrl}
                    alt={currentProduct.name}
                    sku={currentProduct.sku}
                    name={currentProduct.name}
                    brand={currentProduct.brand}
                    width={720}
                    height={720}
                    imageClassName="h-full min-h-[20rem] w-full object-cover"
                    fallbackWrapperClassName="min-h-[20rem]"
                  />
                </div>

                <div className="min-w-0">
                  <div className="inline-flex rounded-full border border-[#1F3B73]/12 bg-[#EEF3FF] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#1F3B73]">
                    карточка товара
                  </div>
                  <h1 className="mt-5 text-3xl font-black tracking-tight text-[#10264B] sm:text-4xl">
                    {currentProduct.name}
                  </h1>
                  {discountLabel ? (
                    <span className="mt-4 inline-flex rounded-full bg-[#FF7A00]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#FF7A00]">
                      {discountLabel}
                    </span>
                  ) : null}

                  <dl className="mt-6 grid grid-cols-1 gap-3 text-sm text-neutral-700 sm:grid-cols-2">
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <dt className="text-neutral-500">Артикул</dt>
                      <dd className="mt-1 break-all font-semibold text-neutral-900">
                        {currentProduct.sku}
                      </dd>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <dt className="text-neutral-500">OEM</dt>
                      <dd className="mt-1 break-all font-semibold text-neutral-900">
                        {currentProduct.oem || "—"}
                      </dd>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <dt className="text-neutral-500">Бренд</dt>
                      <dd className="mt-1 font-semibold text-neutral-900">
                        {currentProduct.brand || "—"}
                      </dd>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <dt className="text-neutral-500">Наличие</dt>
                      <dd
                        className={`mt-1 font-semibold ${currentProduct.stock_quantity > 0 ? "text-emerald-700" : "text-amber-700"}`}
                      >
                        {currentProduct.stock_quantity > 0
                          ? "в наличии"
                          : "под заказ"}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-6 rounded-[1.75rem] border border-neutral-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] p-5">
                    {typeof oldPrice === "number" &&
                    typeof currentProduct.price === "number" &&
                    !requestMode &&
                    oldPrice > currentProduct.price ? (
                      <div className="text-sm text-neutral-400 line-through">
                        {oldPrice.toLocaleString("ru-RU")} ₽
                      </div>
                    ) : null}
                    <div className="text-4xl font-black tracking-tight text-[#1F3B73]">
                      {formatPriceLabel(
                        currentProduct.attributes,
                        currentProduct.price,
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">
                      {requestMode
                        ? "Менеджер уточнит стоимость и срок поставки после заявки."
                        : "Актуальная цена из каталога. Для уточнения доступности можно оставить запрос."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-[2rem] bg-[linear-gradient(135deg,#1F3B73_0%,#17315E_65%,#10264B_100%)] p-6 text-white shadow-[0_28px_70px_rgba(31,59,115,0.18)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FFB166]">
                  быстрые действия
                </div>
                <div className="mt-4 space-y-3">
                  <AddToCartButton
                    productId={currentProduct.id}
                    sku={currentProduct.sku}
                    name={currentProduct.name}
                    price={effectivePrice}
                    buttonLabel="Добавить в корзину"
                    buttonClassName="inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#1F3B73] transition-colors hover:bg-[#EEF3FF]"
                    noticeClassName="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/88"
                  />
                  <Link
                    href={`/parts/p/${encodeURIComponent(currentProduct.sku)}#product-lead-form`}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/16"
                  >
                    Запросить товар
                  </Link>
                  <Link
                    href={installRequestHref}
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/16"
                  >
                    Запчасть + установка
                  </Link>
                  <Link
                    href="/parts/vin"
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/16"
                  >
                    Оставить VIN-заявку
                  </Link>
                  <Link
                    href="/contacts"
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/16"
                  >
                    Связаться с менеджером
                  </Link>
                </div>
              </div>

              <div className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF7A00]">
                  дополнительно
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  <FavoriteToggleButton
                    productId={currentProduct.id}
                    sku={currentProduct.sku}
                    name={currentProduct.name}
                    price={effectivePrice}
                    imageUrl={mainImageUrl}
                  />
                  <Link
                    href="/cart"
                    className="inline-flex items-center justify-center rounded-2xl border border-[#1F3B73]/15 bg-[#EEF3FF] px-4 py-3 text-sm font-semibold text-[#1F3B73] transition-colors hover:bg-[#E1EAFB]"
                  >
                    Перейти в корзину
                  </Link>
                  <Link
                    href="/parts"
                    className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                  >
                    Вернуться в каталог
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF7A00]">
              описание
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#10264B]">
              О товаре
            </h2>
            <p className="mt-4 text-sm leading-7 text-neutral-600">
              {currentProduct.description ||
                "Описание пока не заполнено. Для уточнения характеристик и совместимости свяжитесь с менеджером."}
            </p>
          </div>

          <div className="space-y-6">
            {compatibilities.length > 0 ? (
              <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF7A00]">
                  совместимость
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#10264B]">
                  Подходящие автомобили
                </h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {compatibilities.map((compatibility, index) => (
                    <div
                      key={`${compatibility.make}-${compatibility.model}-${index}`}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                    >
                      <div className="font-semibold text-neutral-900">
                        {compatibility.make} {compatibility.model}
                      </div>
                      <div className="mt-1 text-sm text-neutral-600">
                        {compatibility.year_from
                          ? `с ${compatibility.year_from}`
                          : ""}
                        {compatibility.year_to
                          ? ` по ${compatibility.year_to}`
                          : ""}
                        {compatibility.engine
                          ? ` · ${compatibility.engine}`
                          : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {analogs.length > 0 ? (
              <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF7A00]">
                  аналоги
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#10264B]">
                  Аналоги и кроссы
                </h2>
                <div className="mt-5 flex flex-wrap gap-2">
                  {analogs.map((analog) => (
                    <span
                      key={analog}
                      className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-medium text-neutral-700"
                    >
                      {analog}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6">
          <ProductLeadForm
            productId={currentProduct.id}
            productSku={currentProduct.sku}
            productName={currentProduct.name}
            productPrice={effectivePrice}
          />
        </div>
      </section>
    </main>
  );
}
