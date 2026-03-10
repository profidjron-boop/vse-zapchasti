"use client";

import {
  RequestDetailsDataCard,
  getRequestStatusLabel,
  RequestDetailsConsentAuditRows,
  RequestDetailsLoading,
  RequestDetailsNotFound,
  RequestDetailsPageFrame,
  RequestDetailsRow,
  REQUEST_STATUS_OPTIONS,
  RequestDetailsStatusPanel,
} from "@/components/admin/request-details-shared";
import type {
  RequestConsentAuditFields,
  RequestStatus,
} from "@/components/admin/request-details-types";
import { useAdminRequestDetails } from "@/components/admin/use-request-details";

type VinRequest = RequestConsentAuditFields & {
  id: number;
  uuid: string;
  status: RequestStatus;
  vin: string;
  name: string | null;
  phone: string;
  email: string | null;
  message: string | null;
  operator_comment: string | null;
};

export default function VinRequestDetailsPage() {
  const {
    request,
    loading,
    saving,
    error,
    success,
    selectedStatus,
    operatorComment,
    setSelectedStatus,
    setOperatorComment,
    saveRequest,
  } = useAdminRequestDetails<VinRequest, VinRequest["status"]>({
    entityPath: "/api/admin/vin-requests",
    unauthorizedRedirectTo: "/admin/login",
    loadErrorMessage: "Ошибка загрузки VIN-заявки",
    saveErrorMessage: "Ошибка сохранения",
    initialStatus: "new",
  });

  if (loading) {
    return <RequestDetailsLoading />;
  }

  if (!request) {
    return (
      <RequestDetailsNotFound
        message="VIN-заявка не найдена"
        backHref="/admin/vin-requests"
      />
    );
  }

  return (
    <RequestDetailsPageFrame
      backHref="/admin/vin-requests"
      title={`VIN-заявка #${request.id}`}
      error={error}
      success={success}
      details={
        <RequestDetailsDataCard>
          <RequestDetailsRow
            label="UUID"
            value={request.uuid}
            valueClassName="break-all font-mono text-xs sm:text-sm"
          />
          <RequestDetailsRow
            label="Статус"
            value={getRequestStatusLabel(request.status)}
          />
          <RequestDetailsRow
            label="VIN"
            value={request.vin}
            valueClassName="break-all font-mono"
          />
          <RequestDetailsRow label="Имя" value={request.name || "—"} />
          <RequestDetailsRow label="Телефон" value={request.phone} />
          <RequestDetailsRow label="Email" value={request.email || "—"} />
          <RequestDetailsRow
            label="Сообщение"
            value={request.message || "—"}
            valueClassName="whitespace-pre-wrap break-words"
          />
          <RequestDetailsConsentAuditRows
            audit={request}
          />
        </RequestDetailsDataCard>
      }
      actions={
        <RequestDetailsStatusPanel
          selectedStatus={selectedStatus}
          onStatusChange={(value) =>
            setSelectedStatus(value as VinRequest["status"])
          }
          statusOptions={REQUEST_STATUS_OPTIONS}
          operatorComment={operatorComment}
          onOperatorCommentChange={setOperatorComment}
          onSave={saveRequest}
          saving={saving}
          saveDisabled={
            selectedStatus === request.status &&
            operatorComment.trim() === (request.operator_comment || "").trim()
          }
        />
      }
    />
  );
}
