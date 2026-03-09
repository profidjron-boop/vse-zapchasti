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
      quantity
    );
    const totals = getCartTotals(items);
    const amountLabel = totals.amount !== null ? `, сумма ~ ${Math.round(totals.amount).toLocaleString("ru-RU")} ₽` : "";
    setNotice(`Товар добавлен в корзину. Позиций: ${totals.count}${amountLabel}.`);
  }

  return (
    <div>
      <button type="button" onClick={handleAddToCart} className={buttonClassName}>
        {buttonLabel}
      </button>
      {notice ? (
        <div role="status" aria-live="polite" className={noticeClassName}>
          {notice}{" "}
          <Link href="/cart" className="font-semibold underline">
            Перейти в корзину
          </Link>
        </div>
      ) : null}
    </div>
  );
}
