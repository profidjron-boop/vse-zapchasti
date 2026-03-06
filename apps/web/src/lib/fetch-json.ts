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
  if (typeof traceIdFromRoot === "string" && traceIdFromRoot.trim()) return traceIdFromRoot.trim();

  const errorObj = (payload as { error?: unknown }).error;
  if (errorObj && typeof errorObj === "object") {
    const traceIdFromError = (errorObj as { trace_id?: unknown }).trace_id;
    if (typeof traceIdFromError === "string" && traceIdFromError.trim()) return traceIdFromError.trim();
  }

  return null;
}

export async function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10000
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const signal = init.signal ?? controller.signal;

  try {
    const response = await fetch(input, { ...init, signal });
    const isJson = (response.headers.get("content-type") || "").includes("application/json");
    const payload = isJson ? await response.json().catch(() => null) : null;

    if (!response.ok) {
      const message = extractErrorMessage(payload) || "Не удалось выполнить запрос";
      const traceId = extractTraceId(payload);
      throw new ApiRequestError(message, response.status, traceId);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiRequestError("Сервер долго не отвечает. Попробуйте ещё раз.");
    }
    throw new ApiRequestError("Ошибка сети. Проверьте подключение и повторите попытку.");
  } finally {
    window.clearTimeout(timeoutId);
  }
}
