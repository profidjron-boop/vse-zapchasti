import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type RouterLike = {
  push: (href: string) => void;
};

type RequestEntity<Status extends string> = {
  id: number;
  status: Status;
  operator_comment: string | null;
};

type UseRequestDetailsOptions<Status extends string> = {
  requestId: string;
  entityPath: string;
  unauthorizedRedirectTo: string;
  loadErrorMessage: string;
  saveErrorMessage: string;
  initialStatus: Status;
  router: RouterLike;
};

type UseAdminRequestDetailsOptions<Status extends string> = Omit<
  UseRequestDetailsOptions<Status>,
  "requestId" | "router"
>;

export function useRequestDetails<
  Entity extends RequestEntity<Status>,
  Status extends string,
>({
  requestId,
  entityPath,
  unauthorizedRedirectTo,
  loadErrorMessage,
  saveErrorMessage,
  initialStatus,
  router,
}: UseRequestDetailsOptions<Status>) {
  const [request, setRequest] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Status>(initialStatus);
  const [operatorComment, setOperatorComment] = useState("");

  const fetchRequest = useCallback(async () => {
    setError("");

    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const payload = await fetchJsonWithTimeout<Entity>(
        withApiBase(apiBaseUrl, `${entityPath}/${requestId}`),
        {},
        12000,
      );
      setRequest(payload);
      setSelectedStatus(payload.status);
      setOperatorComment(payload.operator_comment || "");
    } catch (fetchError) {
      if (
        fetchError instanceof ApiRequestError &&
        (fetchError.status === 401 || fetchError.status === 403)
      ) {
        router.push(unauthorizedRedirectTo);
        return;
      }
      if (fetchError instanceof ApiRequestError) {
        setError(
          fetchError.traceId
            ? `${fetchError.message}. Код: ${fetchError.traceId}`
            : fetchError.message,
        );
      } else {
        setError(loadErrorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [entityPath, loadErrorMessage, requestId, router, unauthorizedRedirectTo]);

  const saveRequest = useCallback(async () => {
    if (!request) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const updated = await fetchJsonWithTimeout<Entity>(
        withApiBase(apiBaseUrl, `${entityPath}/${request.id}/status`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: selectedStatus,
            operator_comment: operatorComment.trim() || null,
          }),
        },
        12000,
      );
      setRequest(updated);
      setSelectedStatus(updated.status);
      setOperatorComment(updated.operator_comment || "");
      setSuccess("Изменения сохранены");
    } catch (saveError) {
      if (
        saveError instanceof ApiRequestError &&
        (saveError.status === 401 || saveError.status === 403)
      ) {
        router.push(unauthorizedRedirectTo);
        return;
      }
      if (saveError instanceof ApiRequestError) {
        setError(
          saveError.traceId
            ? `${saveError.message}. Код: ${saveError.traceId}`
            : saveError.message,
        );
      } else {
        setError(saveErrorMessage);
      }
    } finally {
      setSaving(false);
    }
  }, [
    entityPath,
    operatorComment,
    request,
    router,
    saveErrorMessage,
    selectedStatus,
    unauthorizedRedirectTo,
  ]);

  return {
    request,
    loading,
    saving,
    error,
    success,
    selectedStatus,
    operatorComment,
    setSelectedStatus,
    setOperatorComment,
    fetchRequest,
    saveRequest,
  };
}

export function useAdminRequestDetails<
  Entity extends RequestEntity<Status>,
  Status extends string,
>({
  entityPath,
  unauthorizedRedirectTo,
  loadErrorMessage,
  saveErrorMessage,
  initialStatus,
}: UseAdminRequestDetailsOptions<Status>) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params.id;

  const details = useRequestDetails<Entity, Status>({
    requestId,
    entityPath,
    unauthorizedRedirectTo,
    loadErrorMessage,
    saveErrorMessage,
    initialStatus,
    router,
  });
  const { fetchRequest } = details;

  useEffect(() => {
    void fetchRequest();
  }, [fetchRequest]);

  return details;
}
