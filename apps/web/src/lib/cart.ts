export type CartItem = {
  productId: number;
  sku: string;
  name: string;
  price: number | null;
  quantity: number;
};

const CART_STORAGE_KEY = "vsez_guest_cart_v1";
export const CART_UPDATED_EVENT = "vsez:cart-updated";

function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const rounded = Math.trunc(value);
  if (rounded < 1) return 1;
  if (rounded > 999) return 999;
  return rounded;
}

function canUseStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function notifyCartUpdated(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CartItem[]>(CART_UPDATED_EVENT, { detail: items }),
  );
}

export function loadCart(): CartItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const productId = Number((item as { productId?: unknown }).productId);
        const sku = String((item as { sku?: unknown }).sku ?? "").trim();
        const name = String((item as { name?: unknown }).name ?? "").trim();
        const quantity = clampQuantity(
          Number((item as { quantity?: unknown }).quantity ?? 1),
        );
        const rawPrice = (item as { price?: unknown }).price;
        const price =
          typeof rawPrice === "number" && Number.isFinite(rawPrice)
            ? rawPrice
            : null;

        if (!Number.isInteger(productId) || productId <= 0) return null;
        if (!sku || !name) return null;

        return { productId, sku, name, price, quantity } satisfies CartItem;
      })
      .filter((item): item is CartItem => item !== null);
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  notifyCartUpdated(items);
}

export function addToCart(
  item: Omit<CartItem, "quantity">,
  quantity = 1,
): CartItem[] {
  const items = loadCart();
  const nextQuantity = clampQuantity(quantity);
  const existingIndex = items.findIndex(
    (entry) => entry.productId === item.productId,
  );

  if (existingIndex >= 0) {
    const existing = items[existingIndex];
    const mergedQuantity = clampQuantity(existing.quantity + nextQuantity);
    items[existingIndex] = { ...existing, quantity: mergedQuantity };
  } else {
    items.push({ ...item, quantity: nextQuantity });
  }

  saveCart(items);
  return items;
}

export function updateCartItemQuantity(
  productId: number,
  quantity: number,
): CartItem[] {
  const items = loadCart();
  const normalizedQuantity = clampQuantity(quantity);
  const nextItems = items.map((item) =>
    item.productId === productId
      ? { ...item, quantity: normalizedQuantity }
      : item,
  );
  saveCart(nextItems);
  return nextItems;
}

export function removeFromCart(productId: number): CartItem[] {
  const items = loadCart();
  const nextItems = items.filter((item) => item.productId !== productId);
  saveCart(nextItems);
  return nextItems;
}

export function clearCart(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(CART_STORAGE_KEY);
  notifyCartUpdated([]);
}

export function getCartTotals(items: CartItem[]): {
  count: number;
  amount: number | null;
} {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  let amount = 0;
  let hasPrice = false;
  for (const item of items) {
    if (typeof item.price === "number" && Number.isFinite(item.price)) {
      amount += item.price * item.quantity;
      hasPrice = true;
    }
  }

  return { count, amount: hasPrice ? amount : null };
}
