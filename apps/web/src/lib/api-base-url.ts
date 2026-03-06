const DEV_API_BASE_URL = "http://localhost:8000";
const DEV_API_PORT = "8000";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
}

export function getServerApiBaseUrl(): string {
  const configuredBaseUrl =
    normalizeBaseUrl(process.env.API_BASE_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (IS_PRODUCTION) {
    throw new Error("API_BASE_URL or NEXT_PUBLIC_API_BASE_URL must be set in production.");
  }

  return DEV_API_BASE_URL;
}

export function getClientApiBaseUrl(): string {
  const explicit = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
  if (explicit) return explicit;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "127.0.0.1" || host === "localhost") {
      return `http://${host}:${DEV_API_PORT}`;
    }
    return window.location.origin;
  }

  return DEV_API_BASE_URL;
}

export function withApiBase(baseUrl: string, path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}
