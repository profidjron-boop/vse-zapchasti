"use client";

import { useState } from "react";
import { isFavorite, toggleFavorite } from "@/lib/favorites";

type FavoriteToggleButtonProps = {
  productId: number;
  sku: string;
  name: string;
  price: number | null;
  imageUrl: string | null;
};

export default function FavoriteToggleButton({
  productId,
  sku,
  name,
  price,
  imageUrl,
}: FavoriteToggleButtonProps) {
  const [active, setActive] = useState(
    typeof window !== "undefined" ? isFavorite(productId) : false,
  );

  function handleToggle() {
    const result = toggleFavorite({
      productId,
      sku,
      name,
      price,
      imageUrl,
    });
    setActive(result.added);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="rounded-2xl border border-neutral-200 px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      aria-pressed={active}
    >
      {active ? "Убрать из избранного" : "В избранное"}
    </button>
  );
}
