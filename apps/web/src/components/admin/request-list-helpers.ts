import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type BulkUpdateStatusesOptions = {
  selectedIds: number[];
  status: string;
  endpointPath: (id: number) => string;
  onUnauthorized: () => void;
};

type BulkUpdateStatusesResult = {
  updated: number;
  failed: number;
  firstError: string;
  redirected: boolean;
};

export async function bulkUpdateStatuses({
  selectedIds,
  status,
  endpointPath,
  onUnauthorized,
}: BulkUpdateStatusesOptions): Promise<BulkUpdateStatusesResult> {
  const apiBaseUrl = getClientApiBaseUrl();
  let updated = 0;
  let failed = 0;
  let firstError = "";

  for (const requestId of selectedIds) {
    try {
      await fetchJsonWithTimeout(
        withApiBase(apiBaseUrl, endpointPath(requestId)),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            operator_comment: null,
          }),
        },
        12000,
      );
      updated += 1;
    } catch (updateError) {
      if (
        updateError instanceof ApiRequestError &&
        (updateError.status === 401 || updateError.status === 403)
      ) {
        onUnauthorized();
        return { updated, failed, firstError, redirected: true };
      }

      failed += 1;
      if (!firstError) {
        if (updateError instanceof ApiRequestError) {
          firstError = updateError.traceId
            ? `${updateError.message}. Код: ${updateError.traceId}`
            : updateError.message;
        } else {
          firstError = `Ошибка обновления ID ${requestId}`;
        }
      }
    }
  }

  return { updated, failed, firstError, redirected: false };
}

export function toCsvCell(value: string): string {
  const normalized = value.replace(/"/g, '""');
  return /[;"\n]/.test(normalized) ? `"${normalized}"` : normalized;
}

export function downloadCsv(
  filenamePrefix: string,
  headers: string[],
  rows: string[][],
) {
  const csv = [
    headers.map(toCsvCell).join(";"),
    ...rows.map((row) => row.map(toCsvCell).join(";")),
  ].join("\n");

  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateLabel = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `${filenamePrefix}-${dateLabel}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
