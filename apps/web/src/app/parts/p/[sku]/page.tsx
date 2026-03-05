import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import ProductLeadForm from "./product-lead-form";

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

              <div className="mt-6 text-3xl font-bold text-[#FF7A00]">
                {currentProduct.price ? `${currentProduct.price.toLocaleString()} ₽` : "Цена по запросу"}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-700">
            <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Описание</div>
            <div>{currentProduct.description || "Описание появится позже. Для уточнения свяжитесь с менеджером."}</div>
          </div>

          <ProductLeadForm productId={currentProduct.id} productSku={currentProduct.sku} productName={currentProduct.name} />

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/parts/vin"
              className="rounded-2xl bg-[#FF7A00] px-5 py-2 text-sm font-medium text-white hover:bg-[#e66e00]"
            >
              Оставить VIN-заявку
            </Link>
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
