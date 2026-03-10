"use client";

import {
  RequestDetailsDataCard,
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

type ServiceRequest = RequestConsentAuditFields & {
  id: number;
  uuid: string;
  status: RequestStatus;
  vehicle_type: "passenger" | "truck";
  service_type: string;
  name: string | null;
  phone: string;
  email: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_engine: string | null;
  vehicle_year: number | null;
  vin: string | null;
  mileage: number | null;
  description: string;
  install_with_part: boolean;
  requested_product_sku: string | null;
  requested_product_name: string | null;
  estimated_bundle_total: number | null;
  operator_comment: string | null;
  preferred_date: string | null;
};

export default function ServiceRequestDetailsPage() {
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
  } = useAdminRequestDetails<ServiceRequest, ServiceRequest["status"]>({
    entityPath: "/api/admin/service-requests",
    unauthorizedRedirectTo: "/admin/login",
    loadErrorMessage: "Ошибка загрузки заявки",
    saveErrorMessage: "Ошибка сохранения",
    initialStatus: "new",
  });

  if (loading) {
    return <RequestDetailsLoading />;
  }

  if (!request) {
    return (
      <RequestDetailsNotFound
        message="Заявка не найдена"
        backHref="/admin/service-requests"
      />
    );
  }

  return (
    <RequestDetailsPageFrame
      backHref="/admin/service-requests"
      title={`Заявка сервиса #${request.id}`}
      error={error}
      success={success}
      details={
        <RequestDetailsDataCard>
          <RequestDetailsRow
            label="UUID"
            value={request.uuid}
            valueClassName="break-all font-mono text-xs sm:text-sm"
          />
          <RequestDetailsRow label="Имя" value={request.name || "—"} />
          <RequestDetailsRow label="Телефон" value={request.phone} />
          <RequestDetailsRow label="Email" value={request.email || "—"} />
          <RequestDetailsRow
            label="Тип техники"
            value={request.vehicle_type === "truck" ? "Грузовая" : "Легковая"}
          />
          <RequestDetailsRow label="Тип услуги" value={request.service_type} />
          <RequestDetailsRow
            label="Связка запчасть + установка"
            value={request.install_with_part ? "Да" : "Нет"}
          />
          <RequestDetailsRow
            label="SKU запчасти"
            value={request.requested_product_sku || "—"}
          />
          <RequestDetailsRow
            label="Название запчасти"
            value={request.requested_product_name || "—"}
          />
          <RequestDetailsRow
            label="Оценка комплекта"
            value={
              typeof request.estimated_bundle_total === "number"
                ? `${request.estimated_bundle_total.toLocaleString("ru-RU")} ₽`
                : "—"
            }
          />
          <RequestDetailsRow
            label="Описание"
            value={request.description}
            valueClassName="whitespace-pre-wrap"
          />
          <RequestDetailsRow
            label="Автомобиль"
            value={
              [
                request.vehicle_make,
                request.vehicle_model,
                request.vehicle_year,
              ]
                .filter(Boolean)
                .join(" ") || "—"
            }
          />
          <RequestDetailsRow
            label="Двигатель"
            value={request.vehicle_engine || "—"}
          />
          <RequestDetailsRow label="VIN" value={request.vin || "—"} />
          <RequestDetailsRow label="Пробег" value={request.mileage || "—"} />
          <RequestDetailsRow
            label="Желаемая дата"
            value={
              request.preferred_date
                ? new Date(request.preferred_date).toLocaleDateString("ru-RU")
                : "—"
            }
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
            setSelectedStatus(value as ServiceRequest["status"])
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
