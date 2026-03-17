export class ApiRequestError extends Error {
  status: number;
  traceId: string | null;

  constructor(message: string, status = 0, traceId: string | null = null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.traceId = traceId;
  }
}

const ADMIN_ACCESS_TOKEN_KEY = "admin_access_token";

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const encodedName = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(";").map((item) => item.trim());
  for (const part of parts) {
    if (part.startsWith(encodedName)) {
      return decodeURIComponent(part.slice(encodedName.length));
    }
  }
  return null;
}

function getAdminAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const token = window.localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
    return token && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

function isUnsafeHttpMethod(method: string): boolean {
  return (
    method === "POST" ||
    method === "PUT" ||
    method === "PATCH" ||
    method === "DELETE"
  );
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();

  const errorObj = (payload as { error?: unknown }).error;
  if (errorObj && typeof errorObj === "object") {
    const message = (errorObj as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }

  return null;
}

function extractTraceId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const traceIdFromRoot = (payload as { trace_id?: unknown }).trace_id;
  if (typeof traceIdFromRoot === "string" && traceIdFromRoot.trim()) {
    return traceIdFromRoot.trim();
  }

  const errorObj = (payload as { error?: unknown }).error;
  if (errorObj && typeof errorObj === "object") {
    const traceIdFromError = (errorObj as { trace_id?: unknown }).trace_id;
    if (typeof traceIdFromError === "string" && traceIdFromError.trim()) {
      return traceIdFromError.trim();
    }
  }

  return null;
}

function shouldAttachAdminBearer(input: RequestInfo | URL): boolean {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  return raw.includes("/api/admin/");
}

export async function fetchJsonWithTimeoutAndResponse<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10000,
): Promise<{ data: T; response: Response }> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const signal = init.signal ?? controller.signal;
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers || {});

  if (shouldAttachAdminBearer(input) && !headers.has("Authorization")) {
    const token = getAdminAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (isUnsafeHttpMethod(method) && !headers.has("X-CSRF-Token")) {
    const csrfToken = getCookieValue("admin_csrf_token");
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  try {
    const response = await fetch(input, {
      ...init,
      method,
      headers,
      credentials: init.credentials ?? "include",
      signal,
    });

    const isJson = (response.headers.get("content-type") || "").includes(
      "application/json",
    );
    const payload = isJson ? await response.json().catch(() => null) : null;

    if (!response.ok) {
      const message =
        extractErrorMessage(payload) || "Не удалось выполнить запрос";
      const traceId = extractTraceId(payload);
      throw new ApiRequestError(message, response.status, traceId);
    }

    return { data: payload as T, response };
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiRequestError(
        "Сервер долго не отвечает. Попробуйте ещё раз.",
      );
    }
    throw new ApiRequestError(
      "Ошибка сети. Проверьте подключение и повторите попытку.",
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10000,
): Promise<T> {
  const { data } = await fetchJsonWithTimeoutAndResponse<T>(
    input,
    init,
    timeoutMs,
  );
  return data;
}
