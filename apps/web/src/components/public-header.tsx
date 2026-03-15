"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CART_UPDATED_EVENT, getCartTotals, loadCart } from "@/lib/cart";

export type PublicNavKey =
  | "parts"
  | "service"
  | "contacts"
  | "about"
  | "favorites"
  | "cart"
  | "orders";

type PublicHeaderLabels = {
  parts: string;
  service: string;
  contacts: string;
  about: string;
  favorites: string;
  cart: string;
  orders: string;
  dealer: string;
  callback: string;
};

type PublicHeaderProps = {
  brandName?: string;
  activeKey?: PublicNavKey;
  labels?: Partial<PublicHeaderLabels>;
  showActions?: boolean;
};

const DEFAULT_LABELS: PublicHeaderLabels = {
  parts: "Запчасти",
  service: "Автосервис",
  contacts: "Контакты",
  about: "О компании",
  favorites: "Избранное",
  cart: "Корзина",
  orders: "Мои заказы",
  dealer: "Для дилеров",
  callback: "Заказать звонок",
};

const NAV_ITEMS: Array<{ key: PublicNavKey; href: string }> = [
  { key: "parts", href: "/parts" },
  { key: "service", href: "/service" },
  { key: "contacts", href: "/contacts" },
  { key: "about", href: "/about" },
  { key: "favorites", href: "/favorites" },
  { key: "cart", href: "/cart" },
  { key: "orders", href: "/account/orders" },
];

const PRIMARY_NAV_KEYS: PublicNavKey[] = [
  "parts",
  "service",
  "contacts",
  "about",
];
const UTILITY_NAV_KEYS: PublicNavKey[] = ["favorites", "cart", "orders"];

function primaryItemClass(active: boolean): string {
  const base =
    "inline-flex items-center rounded-full px-3 py-2 text-sm font-medium transition-colors";
  return active
    ? `${base} bg-[#EEF3FF] text-[#1F3B73]`
    : `${base} text-neutral-700 hover:bg-neutral-100 hover:text-[#1F3B73]`;
}

function utilityItemClass(active: boolean): string {
  const base =
    "inline-flex items-center rounded-full border px-3 py-2 text-sm font-medium transition-colors";
  return active
    ? `${base} border-[#1F3B73]/20 bg-[#EEF3FF] text-[#1F3B73]`
    : `${base} border-neutral-200 bg-white text-neutral-700 hover:border-[#1F3B73]/20 hover:bg-neutral-50 hover:text-[#1F3B73]`;
}

function mobileNavItemClass(active: boolean): string {
  const base =
    "shrink-0 rounded-full border px-3 py-2 text-sm font-medium transition-colors";
  return active
    ? `${base} border-[#1F3B73]/20 bg-[#EEF3FF] text-[#1F3B73]`
    : `${base} border-neutral-200 bg-white text-neutral-700 hover:border-[#1F3B73]/20 hover:text-[#1F3B73]`;
}

function getCartCount(): number {
  return getCartTotals(loadCart()).count;
}

function renderNavLabel(key: PublicNavKey, label: string, cartCount: number) {
  if (key !== "cart") {
    return label;
  }
  const cartLabel = cartCount > 99 ? "99+" : String(cartCount);
  const cartBadgeClass =
    cartCount > 0
      ? "bg-[#1F3B73] text-white"
      : "bg-neutral-200 text-neutral-600";

  return (
    <span className="inline-flex items-center gap-2">
      <span>{label}</span>
      <span
        className={`inline-flex h-5 w-7 items-center justify-center rounded-full text-[11px] font-semibold leading-none ${cartBadgeClass}`}
      >
        {cartLabel}
      </span>
    </span>
  );
}

export function PublicHeader({
  brandName = "Все запчасти",
  activeKey,
  labels,
  showActions = true,
}: PublicHeaderProps) {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const syncCartCount = () => {
      setCartCount(getCartCount());
    };

    syncCartCount();
    window.addEventListener("storage", syncCartCount);
    window.addEventListener(CART_UPDATED_EVENT, syncCartCount);

    return () => {
      window.removeEventListener("storage", syncCartCount);
      window.removeEventListener(CART_UPDATED_EVENT, syncCartCount);
    };
  }, []);

  const merged = { ...DEFAULT_LABELS, ...(labels ?? {}) };
  const primaryItems = NAV_ITEMS.filter((item) =>
    PRIMARY_NAV_KEYS.includes(item.key),
  );
  const utilityItems = NAV_ITEMS.filter((item) =>
    UTILITY_NAV_KEYS.includes(item.key),
  );

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90">
      <div className="hidden border-b border-neutral-200 bg-neutral-50/90 sm:block">
        <div className="mx-auto flex max-w-[92rem] items-center justify-between gap-3 px-4 py-1.5 text-xs text-neutral-500 sm:px-6">
          <p className="truncate font-medium text-neutral-600">
            Каталог запчастей и сервис для коммерческого транспорта и легковых
            авто
          </p>
          <div className="hidden items-center gap-3 md:flex">
            <span>Ваш город</span>
            <span
              className="h-1 w-1 rounded-full bg-neutral-300"
              aria-hidden="true"
            />
            <span>Пн-Сб 09:00-19:00</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[92rem] px-4 py-2 sm:px-6">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:gap-5">
          <div className="flex items-center justify-between gap-4 xl:w-[15rem] xl:flex-none">
            <Link href="/" className="min-w-0 shrink-0">
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#FF7A00]">
                industrial parts
              </div>
              <div className="truncate text-xl font-black tracking-tight text-[#1F3B73]">
                {brandName}
              </div>
            </Link>
          </div>

          <form
            action="/parts"
            method="get"
            className="flex flex-1 items-center gap-3"
          >
            <label htmlFor="public-header-search" className="sr-only">
              Поиск по каталогу
            </label>
            <div className="relative flex-1">
              <input
                id="public-header-search"
                name="q"
                type="search"
                placeholder="Поиск по артикулу, OEM или названию"
                className="h-10 w-full rounded-2xl border border-neutral-200 bg-white px-4 pr-32 text-sm text-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition-colors placeholder:text-neutral-400 focus:border-[#1F3B73]/30"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 hidden items-center text-xs font-medium uppercase tracking-[0.18em] text-neutral-400 md:flex">
                SKU / OEM
              </span>
            </div>
            <button
              type="submit"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl bg-[#FF7A00] px-5 text-sm font-semibold text-white shadow-lg shadow-[#FF7A00]/20 transition-colors hover:bg-[#E86F00]"
            >
              Найти
            </button>
          </form>

          {showActions ? (
            <div className="hidden items-center gap-2 xl:flex xl:flex-none">
              <Link
                href="/contacts"
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-[#1F3B73]/20 hover:bg-neutral-50 hover:text-[#1F3B73]"
              >
                {merged.dealer}
              </Link>
              <Link
                href="/contacts#callback-form"
                className="rounded-full bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-[#1F3B73]/15 transition-colors hover:bg-[#14294F]"
              >
                {merged.callback}
              </Link>
            </div>
          ) : null}

          <nav className="hidden items-center gap-2 2xl:flex">
            {utilityItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={utilityItemClass(activeKey === item.key)}
              >
                {renderNavLabel(item.key, merged[item.key], cartCount)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-1.5 flex flex-col gap-2 border-t border-neutral-200 pt-1.5">
          <div className="hidden items-center justify-between gap-3 xl:flex">
            <nav className="flex flex-wrap items-center gap-2">
              {primaryItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={primaryItemClass(activeKey === item.key)}
                >
                  {merged[item.key]}
                </Link>
              ))}
            </nav>

            <nav className="flex flex-wrap items-center gap-2 2xl:hidden">
              {utilityItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={utilityItemClass(activeKey === item.key)}
                >
                  {renderNavLabel(item.key, merged[item.key], cartCount)}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-3 xl:hidden">
            {showActions ? (
              <div className="flex flex-col gap-2">
                <Link
                  href="/contacts#callback-form"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#1F3B73] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#14294F]"
                >
                  {merged.callback}
                </Link>
                <Link
                  href="/contacts"
                  className="inline-flex items-center justify-center rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-[#1F3B73]/20 hover:bg-neutral-50 hover:text-[#1F3B73]"
                >
                  {merged.dealer}
                </Link>
              </div>
            ) : null}

            <nav className="flex items-center gap-2 overflow-x-auto pb-1">
              {[...primaryItems, ...utilityItems].map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={mobileNavItemClass(activeKey === item.key)}
                >
                  {renderNavLabel(item.key, merged[item.key], cartCount)}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
