"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addToCart } from "@/lib/cart";
import { PublicFooter } from "@/components/public-footer";
import { usePublicSiteContent } from "@/components/use-public-site-content";
import {
  FavoriteItem,
  clearFavorites,
  loadFavorites,
  removeFavorite,
} from "@/lib/favorites";
import { PublicHeader } from "@/components/public-header";

function formatPrice(value: number | null): string {
  return value !== null
    ? `${Math.round(value).toLocaleString("ru-RU")} ₽`
    : "Цена по запросу";
}

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const { brandName, footerText, labels, contentValue } = usePublicSiteContent();
  const isEmptyState = !loading && items.length === 0;

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setItems(loadFavorites());
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;

    const timeoutId = window.setTimeout(() => {
      setNotice("");
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

  const pageTitle = contentValue("favorites_page_title", "Избранное");
  const clearListLabel = contentValue(
    "favorites_clear_label",
    "Очистить список",
  );
  const emptyText = contentValue(
    "favorites_empty_text",
    "Список избранного пока пуст.",
  );
  const openCatalogLabel = contentValue(
    "favorites_open_catalog_label",
    "Открыть каталог",
  );
  const openProductLabel = contentValue(
    "favorites_open_product_label",
    "К товару",
  );
  const addToCartLabel = contentValue(
    "favorites_add_to_cart_label",
    "В корзину",
  );

  function handleRemove(productId: number) {
    setItems(removeFavorite(productId));
  }

  function handleMoveToCart(item: FavoriteItem) {
    addToCart(
      {
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        price: item.price,
      },
      1,
    );
    setNotice(`Товар "${item.name}" добавлен в корзину.`);
  }

  function handleClear() {
    clearFavorites();
    setItems([]);
  }

  return (
    <main className="min-h-dvh bg-[#F3F5F8] text-neutral-900">
      <PublicHeader
        brandName={brandName}
        activeKey="favorites"
        labels={labels}
      />

      <section className="border-b border-neutral-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef3fb_100%)]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] lg:py-14">
          <div className="rounded-[2rem] bg-[linear-gradient(135deg,#1F3B73_0%,#17315E_65%,#10264B_100%)] p-8 text-white shadow-[0_30px_80px_rgba(31,59,115,0.18)]">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              wishlist · saved products · compare later
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
              {pageTitle}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
              {isEmptyState
                ? "Сохраняйте интересующие позиции, чтобы вернуться к ним позже, сравнить и быстро перенести в корзину."
                : "Сохраняйте интересующие позиции, возвращайтесь к ним позже и быстро переносите нужные товары в корзину."}
            </p>
            {isEmptyState ? (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/60">
                    первый шаг
                  </div>
                  <div className="mt-2 text-base font-semibold">
                    Откройте каталог и сохраните интересующие товары
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/60">
                    второй шаг
                  </div>
                  <div className="mt-2 text-base font-semibold">
                    Вернитесь к ним позже и перенесите нужные позиции в корзину
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/60">
                    товаров в списке
                  </div>
                  <div className="mt-2 text-2xl font-bold">{items.length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/60">
                    следующий шаг
                  </div>
                  <div className="mt-2 text-base font-semibold">
                    Перенос в корзину или переход в карточку
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF7A00]">
              как использовать список
            </div>
            <div className="mt-4 space-y-3">
              {(isEmptyState
                ? [
                    "Сохраняйте редкие или отложенные позиции, чтобы не искать их заново.",
                    "Открывайте карточку товара, когда будете готовы уточнить цену, наличие и совместимость.",
                    "Соберите собственный shortlist и перенесите нужные товары в корзину в один шаг.",
                  ]
                : [
                    "Сохраняйте редкие или отложенные позиции без оформления заказа.",
                    "Открывайте карточку товара, чтобы уточнить наличие, цену и совместимость.",
                    "Переносите нужные позиции в корзину одной кнопкой без повторного поиска.",
                  ]
              ).map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-600"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Link
                href="/parts"
                className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:border-[#1F3B73] hover:text-[#1F3B73]"
              >
                {openCatalogLabel}
              </Link>
              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center justify-center rounded-2xl bg-[#FF7A00] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#e66e00]"
                >
                  {clearListLabel}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-6 min-h-[3.75rem]">
          {notice ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 shadow-[0_10px_30px_rgba(34,197,94,0.08)]">
              {notice}
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-8 text-sm text-neutral-500 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
            Загрузка избранного...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[2rem] border border-neutral-200 bg-white p-10 text-center shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
            <div className="mx-auto max-w-2xl">
              <h2 className="text-2xl font-bold text-[#10264B]">{emptyText}</h2>
              <p className="mt-3 text-sm leading-7 text-neutral-600">
                Добавляйте сюда товары, которые хотите сравнить, показать
                менеджеру или заказать позже. Избранное подойдёт как рабочий
                shortlist перед оформлением заказа.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/parts"
                  className="inline-flex items-center justify-center rounded-2xl bg-[#1F3B73] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#17315E]"
                >
                  {openCatalogLabel}
                </Link>
                <Link
                  href="/parts/vin"
                  className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  Оставить VIN-заявку
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className={items.length > 1 ? "grid gap-4 xl:grid-cols-2" : "grid gap-4"}>
            {items.map((item) => (
              <article
                key={item.productId}
                className="rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)] sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF7A00]">
                      sku · {item.sku}
                    </div>
                    <h2 className="mt-2 text-xl font-bold text-[#10264B]">
                      {item.name}
                    </h2>
                    <div className="mt-3 inline-flex rounded-full bg-neutral-100 px-3 py-1 text-sm font-semibold text-neutral-700">
                      {formatPrice(item.price)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.productId)}
                    className="inline-flex items-center justify-center rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Удалить
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/parts/p/${encodeURIComponent(item.sku)}`}
                    className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:border-[#1F3B73] hover:text-[#1F3B73]"
                  >
                    {openProductLabel}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleMoveToCart(item)}
                    className="inline-flex items-center justify-center rounded-2xl bg-[#FF7A00] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#e66e00]"
                  >
                    {addToCartLabel}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <PublicFooter
        brandName={brandName}
        footerText={footerText}
        contactsLabel={labels.contacts}
      />
    </main>
  );
}
