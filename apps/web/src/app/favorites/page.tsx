"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addToCart } from "@/lib/cart";
import { FavoriteItem, clearFavorites, loadFavorites, removeFavorite } from "@/lib/favorites";

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setItems(loadFavorites());
      setLoading(false);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

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
      1
    );
    setNotice(`Товар "${item.name}" добавлен в корзину.`);
  }

  function handleClear() {
    clearFavorites();
    setItems([]);
  }

  return (
    <main className="min-h-dvh bg-[#F5F7FA] text-neutral-900">
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-2xl font-bold text-[#1F3B73]">Все запчасти</Link>
            <nav className="hidden items-center gap-8 md:flex">
              <Link href="/parts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Запчасти</Link>
              <Link href="/favorites" className="text-sm font-medium text-[#1F3B73] border-b-2 border-[#1F3B73] pb-1">Избранное</Link>
              <Link href="/cart" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Корзина</Link>
              <Link href="/account/orders" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Мои заказы</Link>
              <Link href="/service" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Автосервис</Link>
              <Link href="/contacts" className="text-sm font-medium text-neutral-700 hover:text-[#1F3B73]">Контакты</Link>
            </nav>
          </div>
          <nav className="mt-3 flex items-center gap-4 overflow-x-auto pb-1 text-sm md:hidden">
            <Link href="/parts" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">Запчасти</Link>
            <Link href="/favorites" className="shrink-0 font-medium text-[#1F3B73]">Избранное</Link>
            <Link href="/cart" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">Корзина</Link>
            <Link href="/account/orders" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">Мои заказы</Link>
            <Link href="/service" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">Автосервис</Link>
            <Link href="/contacts" className="shrink-0 font-medium text-neutral-700 hover:text-[#1F3B73]">Контакты</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-[#1F3B73]">Избранное</h1>
          {items.length > 0 ? (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Очистить список
            </button>
          ) : null}
        </div>

        {notice ? (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {notice}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
            Загрузка...
          </div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-8 text-center">
            <p className="text-neutral-600">Список избранного пока пуст.</p>
            <Link
              href="/parts"
              className="mt-4 inline-block rounded-2xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#14294F]"
            >
              Открыть каталог
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {items.map((item) => (
              <article key={item.productId} className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900">{item.name}</p>
                    <p className="mt-1 break-all text-xs text-neutral-500">{item.sku}</p>
                    <p className="mt-2 text-sm font-semibold text-[#1F3B73]">
                      {item.price !== null ? `${Math.round(item.price).toLocaleString("ru-RU")} ₽` : "Цена по запросу"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.productId)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Удалить
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/parts/p/${encodeURIComponent(item.sku)}`}
                    className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    К товару
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleMoveToCart(item)}
                    className="rounded-xl bg-[#FF7A00] px-3 py-2 text-sm font-medium text-white hover:bg-[#e66e00]"
                  >
                    В корзину
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
