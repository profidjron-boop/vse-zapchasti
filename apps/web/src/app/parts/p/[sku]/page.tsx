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
};

async function getProductBySku(sku: string): Promise<Product | null> {
  const apiBaseUrl = getServerApiBaseUrl();
  const response = await fetch(
    withApiBase(apiBaseUrl, `/api/public/products/by-sku/${encodeURIComponent(sku)}`),
    { cache: "no-store" }
  );

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    return null;
  }

  return (await response.json()) as Product;
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

  const product = await getProductBySku(sku);
  if (!product) {
    notFound();
  }

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
          <h1 className="text-2xl font-semibold text-[#1F3B73]">{product.name}</h1>

          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm text-neutral-700 sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">Артикул</dt>
              <dd className="font-medium">{product.sku}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">OEM</dt>
              <dd>{product.oem || "—"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Бренд</dt>
              <dd>{product.brand || "—"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Наличие</dt>
              <dd className={product.stock_quantity > 0 ? "font-medium text-green-700" : "font-medium text-amber-700"}>
                {product.stock_quantity > 0 ? "в наличии" : "под заказ"}
              </dd>
            </div>
          </dl>

          <div className="mt-6 text-3xl font-bold text-[#FF7A00]">
            {product.price ? `${product.price.toLocaleString()} ₽` : "Цена по запросу"}
          </div>

          <div className="mt-6 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-700">
            <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Описание</div>
            <div>{product.description || "Описание появится позже. Для уточнения свяжитесь с менеджером."}</div>
          </div>

          <ProductLeadForm productId={product.id} productSku={product.sku} productName={product.name} />

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
