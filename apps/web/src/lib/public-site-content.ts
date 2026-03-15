import {
  getClientApiBaseUrl,
  getServerApiBaseUrl,
  withApiBase,
} from "@/lib/api-base-url";

type PublicContentRow = {
  key?: string;
  value?: string | null;
};

export type PublicContentMap = Record<string, string>;

export type PublicSiteLabels = {
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

export type PublicSiteContent = {
  brandName: string;
  footerText: string;
  labels: PublicSiteLabels;
};

const PUBLIC_CONTENT_ENDPOINT = "/api/public/content";

const DEFAULT_PUBLIC_SITE_CONTENT: PublicSiteContent = {
  brandName: "Все запчасти",
  footerText: "Все запчасти · Ваш город · NO CDN",
  labels: {
    parts: "Запчасти",
    service: "Автосервис",
    contacts: "Контакты",
    about: "О компании",
    favorites: "Избранное",
    cart: "Корзина",
    orders: "Мои заказы",
    dealer: "Для дилеров",
    callback: "Заказать звонок",
  },
};

function parsePublicContentPayload(payload: unknown): PublicContentMap {
  if (!Array.isArray(payload)) {
    return {};
  }

  const map: PublicContentMap = {};
  for (const item of payload as PublicContentRow[]) {
    if (item?.key && typeof item.value === "string") {
      map[item.key] = item.value;
    }
  }
  return map;
}

async function fetchPublicContentMap(baseUrl: string): Promise<PublicContentMap> {
  try {
    const response = await fetch(withApiBase(baseUrl, PUBLIC_CONTENT_ENDPOINT), {
      cache: "no-store",
    });
    if (!response.ok) {
      return {};
    }
    const payload = await response.json();
    return parsePublicContentPayload(payload);
  } catch {
    return {};
  }
}

export async function fetchPublicContentMapServer(): Promise<PublicContentMap> {
  return fetchPublicContentMap(getServerApiBaseUrl());
}

export async function fetchPublicContentMapClient(): Promise<PublicContentMap> {
  return fetchPublicContentMap(getClientApiBaseUrl());
}

export function getPublicContentValue(
  contentMap: PublicContentMap,
  key: string,
  fallback: string,
): string {
  const value = contentMap[key];
  return value && value.trim() ? value : fallback;
}

export function getPublicSiteContent(
  contentMap: PublicContentMap,
): PublicSiteContent {
  return {
    brandName: getPublicContentValue(
      contentMap,
      "site_brand_name",
      DEFAULT_PUBLIC_SITE_CONTENT.brandName,
    ),
    footerText: getPublicContentValue(
      contentMap,
      "site_footer_text",
      DEFAULT_PUBLIC_SITE_CONTENT.footerText,
    ),
    labels: {
      parts: getPublicContentValue(
        contentMap,
        "site_nav_parts_label",
        DEFAULT_PUBLIC_SITE_CONTENT.labels.parts,
      ),
      service: getPublicContentValue(
        contentMap,
        "site_nav_service_label",
        DEFAULT_PUBLIC_SITE_CONTENT.labels.service,
      ),
      contacts: getPublicContentValue(
        contentMap,
        "site_nav_contacts_label",
        DEFAULT_PUBLIC_SITE_CONTENT.labels.contacts,
      ),
      about: getPublicContentValue(
        contentMap,
        "site_nav_about_label",
        DEFAULT_PUBLIC_SITE_CONTENT.labels.about,
      ),
      favorites: getPublicContentValue(
        contentMap,
        "site_nav_favorites_label",
        DEFAULT_PUBLIC_SITE_CONTENT.labels.favorites,
      ),
      cart: getPublicContentValue(
        contentMap,
        "site_nav_cart_label",
        DEFAULT_PUBLIC_SITE_CONTENT.labels.cart,
      ),
      orders: getPublicContentValue(
        contentMap,
        "site_nav_orders_label",
        DEFAULT_PUBLIC_SITE_CONTENT.labels.orders,
      ),
      dealer: getPublicContentValue(
        contentMap,
        "site_nav_dealer_label",
        DEFAULT_PUBLIC_SITE_CONTENT.labels.dealer,
      ),
      callback: getPublicContentValue(
        contentMap,
        "site_nav_callback_label",
        DEFAULT_PUBLIC_SITE_CONTENT.labels.callback,
      ),
    },
  };
}
