"use client";

import Link from "next/link";
import { useState } from "react";
import { addToCart, getCartTotals } from "@/lib/cart";

type AddToCartButtonProps = {
  productId: number;
  sku: string;
  name: string;
  price?: number | null;
  quantity?: number;
  buttonLabel?: string;
  buttonClassName?: string;
  noticeClassName?: string;
  stabilizeNoticeHeight?: boolean;
  noticeBehavior?: "inline" | "overlay";
};

const DEFAULT_BUTTON_CLASS =
  "inline-flex w-full items-center justify-center rounded-2xl bg-[#FF7A00] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#E86F00]";

const DEFAULT_NOTICE_CLASS =
  "mt-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800";

export function AddToCartButton({
  productId,
  sku,
  name,
  price = null,
  quantity = 1,
  buttonLabel = "В корзину",
  buttonClassName = DEFAULT_BUTTON_CLASS,
  noticeClassName = DEFAULT_NOTICE_CLASS,
  stabilizeNoticeHeight = false,
  noticeBehavior = "inline",
}: AddToCartButtonProps) {
  const [notice, setNotice] = useState("");

  function handleAddToCart() {
    const items = addToCart(
      {
        productId,
        sku,
        name,
        price,
      },
      quantity,
    );
    const totals = getCartTotals(items);
    const amountLabel =
      totals.amount !== null
        ? `, сумма ~ ${Math.round(totals.amount).toLocaleString("ru-RU")} ₽`
        : "";
    setNotice(
      `Товар добавлен в корзину. Позиций: ${totals.count}${amountLabel}.`,
    );
  }

  return (
    <div className={noticeBehavior === "overlay" ? "relative" : undefined}>
      <button
        type="button"
        onClick={handleAddToCart}
        className={buttonClassName}
      >
        {buttonLabel}
      </button>
      {noticeBehavior === "overlay" ? (
        notice ? (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute inset-x-0 bottom-full z-20 mb-2"
          >
            <div
              className={`${noticeClassName} pointer-events-auto mt-0 rounded-xl px-3 py-2 text-xs shadow-[0_16px_34px_rgba(15,23,42,0.16)]`}
            >
              <div className="line-clamp-2">{notice}</div>
              <Link href="/cart" className="mt-1 inline-block font-semibold underline">
                Перейти в корзину
              </Link>
            </div>
          </div>
        ) : null
      ) : (
        <div className={stabilizeNoticeHeight ? "mt-2 min-h-[3.5rem]" : "mt-2"}>
          {notice ? (
            <div role="status" aria-live="polite" className={noticeClassName}>
              {notice}{" "}
              <Link href="/cart" className="font-semibold underline">
                Перейти в корзину
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
