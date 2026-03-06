import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServerApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import ProductLeadForm from "./product-lead-form";
import FavoriteToggleButton from "./favorite-toggle-button";

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

async function getProductBySku(sku: string): Promise<{ product: Product | null; hasError: boolean }> {
  try {
    const apiBaseUrl = getServerApiBaseUrl();
    const response = await fetch(
      withApiBase(apiBaseUrl, `/api/public/products/by-sku/${encodeURIComponent(sku)}`),
      { cache: "no-store" }
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

function getMainImageUrl(product: Product): string | null {
  const images = product.images ?? [];
  if (images.length === 0) return null;
  const main = images.find((image) => image.is_main) ?? images[0];
  return main?.url || null;
}

function getNumericAttribute(attributes: Record<string, unknown> | undefined, key: string): number | null {
  if (!attributes) return null;
  const value = attributes[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getStringAttribute(attributes: Record<string, unknown> | undefined, key: string): string | null {
  if (!attributes) return null;
  const value = attributes[key];
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function getStringListAttribute(attributes: Record<string, unknown> | undefined, keys: string[]): string[] {
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
    product.description?.trim()
    || `${product.name}. Артикул: ${product.sku}${product.brand ? `, бренд: ${product.brand}` : ""}.`;
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
}: {
  params: Promise<{ sku: string }>;
}) {
  const routeParams = await params;
  const sku = routeParams.sku?.trim();
  if (!sku) {
    notFound();
  }

  const { product, hasError } = await getProductBySku(sku);
  if (!product && !hasError) {
    notFound();
  }
  if (!product && hasError) {
    return (
      <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
        <section className="mx-auto max-w-4xl px-6 py-16">
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center">
            <h1 className="text-xl font-semibold text-[#1F3B73]">Товар временно недоступен</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Не удалось загрузить карточку товара. Повторите попытку чуть позже.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/parts" className="rounded-2xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#14294F]">
                Вернуться в каталог
              </Link>
              <Link href="/parts/vin" className="rounded-2xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
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
    getStringAttribute(currentProduct.attributes, "discount_label")
    || getStringAttribute(currentProduct.attributes, "sale_badge");
  const analogs = getStringListAttribute(currentProduct.attributes, ["analogs", "crosses", "cross_codes"]);
  const compatibilities = currentProduct.compatibilities ?? [];

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
              <Link href="/favorites" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Избранное</Link>
              <Link href="/cart" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Корзина</Link>
              <Link href="/account/orders" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Мои заказы</Link>
            </nav>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/parts" className="text-sm font-medium text-[#1F3B73] hover:underline">
          ← Вернуться в каталог
        </Link>

        <div className="mt-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-lg">
          <div className="grid gap-6 md:grid-cols-[280px_1fr]">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
              {mainImageUrl ? (
                <Image
                  src={mainImageUrl}
                  alt={currentProduct.name}
                  className="h-full w-full object-cover"
                  width={560}
                  height={560}
                />
              ) : (
                <div className="flex min-h-[260px] items-center justify-center text-sm text-neutral-400">
                  Изображение отсутствует
                </div>
              )}
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-[#1F3B73]">{currentProduct.name}</h1>
              {discountLabel ? (
                <span className="mt-2 inline-block rounded-full bg-[#FF7A00]/10 px-3 py-1 text-xs font-medium text-[#FF7A00]">
                  {discountLabel}
                </span>
              ) : null}

              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm text-neutral-700 sm:grid-cols-2">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <dt className="text-neutral-500">Артикул</dt>
                  <dd className="font-medium">{currentProduct.sku}</dd>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <dt className="text-neutral-500">OEM</dt>
                  <dd>{currentProduct.oem || "—"}</dd>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <dt className="text-neutral-500">Бренд</dt>
                  <dd>{currentProduct.brand || "—"}</dd>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <dt className="text-neutral-500">Наличие</dt>
                  <dd className={currentProduct.stock_quantity > 0 ? "font-medium text-green-700" : "font-medium text-amber-700"}>
                    {currentProduct.stock_quantity > 0 ? "в наличии" : "под заказ"}
                  </dd>
                </div>
              </dl>

              <div className="mt-6">
                {typeof oldPrice === "number" && typeof currentProduct.price === "number" && oldPrice > currentProduct.price ? (
                  <div className="text-sm text-neutral-500 line-through">
                    {oldPrice.toLocaleString("ru-RU")} ₽
                  </div>
                ) : null}
                <div className="text-3xl font-bold text-[#FF7A00]">
                  {currentProduct.price ? `${currentProduct.price.toLocaleString("ru-RU")} ₽` : "Цена по запросу"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-700">
            <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Описание</div>
            <div>{currentProduct.description || "Описание появится позже. Для уточнения свяжитесь с менеджером."}</div>
          </div>

          {compatibilities.length > 0 ? (
            <div className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-700">
              <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Совместимость</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {compatibilities.map((compatibility, index) => (
                  <div key={`${compatibility.make}-${compatibility.model}-${index}`} className="rounded-xl bg-white px-3 py-2">
                    <div className="font-medium text-neutral-900">
                      {compatibility.make} {compatibility.model}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {compatibility.year_from ? `с ${compatibility.year_from}` : ""}
                      {compatibility.year_to ? ` по ${compatibility.year_to}` : ""}
                      {compatibility.engine ? ` · ${compatibility.engine}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {analogs.length > 0 ? (
            <div className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-700">
              <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Аналоги / кроссы</div>
              <div className="flex flex-wrap gap-2">
                {analogs.map((analog) => (
                  <span key={analog} className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-700">
                    {analog}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <ProductLeadForm productId={currentProduct.id} productSku={currentProduct.sku} productName={currentProduct.name} />

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/parts/vin"
              className="rounded-2xl bg-[#FF7A00] px-5 py-2 text-sm font-medium text-white hover:bg-[#e66e00]"
            >
              Оставить VIN-заявку
            </Link>
            <FavoriteToggleButton
              productId={currentProduct.id}
              sku={currentProduct.sku}
              name={currentProduct.name}
              price={currentProduct.price}
              imageUrl={mainImageUrl}
            />
            <Link
              href="/contacts"
              className="rounded-2xl border border-neutral-200 px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Связаться с менеджером
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
