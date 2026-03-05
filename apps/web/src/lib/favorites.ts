export type FavoriteItem = {
  productId: number;
  sku: string;
  name: string;
  price: number | null;
  imageUrl: string | null;
  updatedAt: string;
};

const FAVORITES_STORAGE_KEY = "vsez:favorites:v1";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function readFavoritesRaw(): FavoriteItem[] {
  if (!hasWindow()) return [];

  try {
    const rawValue = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!rawValue) return [];

    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        const candidate = item as Partial<FavoriteItem>;
        if (
          typeof candidate.productId !== "number" ||
          !Number.isFinite(candidate.productId) ||
          typeof candidate.sku !== "string" ||
          typeof candidate.name !== "string"
        ) {
          return null;
        }

        return {
          productId: candidate.productId,
          sku: candidate.sku.trim(),
          name: candidate.name.trim(),
          price: typeof candidate.price === "number" ? candidate.price : null,
          imageUrl: typeof candidate.imageUrl === "string" ? candidate.imageUrl : null,
          updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString(),
        } satisfies FavoriteItem;
      })
      .filter((item): item is FavoriteItem => item !== null);
  } catch {
    return [];
  }
}

function writeFavorites(items: FavoriteItem[]): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(items));
}

export function loadFavorites(): FavoriteItem[] {
  return readFavoritesRaw();
}

export function isFavorite(productId: number): boolean {
  return readFavoritesRaw().some((item) => item.productId === productId);
}

export function toggleFavorite(
  nextItem: Omit<FavoriteItem, "updatedAt">
): { items: FavoriteItem[]; added: boolean } {
  const currentItems = readFavoritesRaw();
  const existingIndex = currentItems.findIndex((item) => item.productId === nextItem.productId);

  if (existingIndex >= 0) {
    const updated = currentItems.filter((item) => item.productId !== nextItem.productId);
    writeFavorites(updated);
    return { items: updated, added: false };
  }

  const itemToStore: FavoriteItem = {
    ...nextItem,
    updatedAt: new Date().toISOString(),
  };
  const updated = [itemToStore, ...currentItems];
  writeFavorites(updated);
  return { items: updated, added: true };
}

export function removeFavorite(productId: number): FavoriteItem[] {
  const currentItems = readFavoritesRaw();
  const updated = currentItems.filter((item) => item.productId !== productId);
  writeFavorites(updated);
  return updated;
}

export function clearFavorites(): void {
  writeFavorites([]);
}
