import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ApiRequestError } from "@/lib/fetch-json";

const ADMIN_LOGIN_PATH = "/admin/login";

function isUnauthorizedAdminError(error: unknown): error is ApiRequestError {
  return (
    error instanceof ApiRequestError &&
    (error.status === 401 || error.status === 403)
  );
}

export function redirectIfAdminUnauthorized(
  error: unknown,
  router: AppRouterInstance,
): boolean {
  if (!isUnauthorizedAdminError(error)) {
    return false;
  }
  router.push(ADMIN_LOGIN_PATH);
  return true;
}

export function toAdminErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (error instanceof ApiRequestError) {
    return error.traceId
      ? `${error.message}. Код: ${error.traceId}`
      : error.message;
  }
  return fallbackMessage;
}
