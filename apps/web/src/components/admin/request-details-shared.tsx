import Link from "next/link";
import type { ReactNode } from "react";
import { AdminFeedback } from "@/components/admin/feedback-shared";
import type {
  RequestConsentAuditFields,
  RequestStatus,
} from "@/components/admin/request-details-types";

type StatusOption = {
  value: string;
  label: string;
};

type DetailsHeaderProps = {
  backHref: string;
  title: string;
};

type NotFoundProps = {
  message: string;
  backHref: string;
};

type FeedbackProps = {
  error: string;
  success: string;
};

type StatusPanelProps = {
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  statusOptions: StatusOption[];
  operatorComment: string;
  onOperatorCommentChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  saveDisabled: boolean;
};

type RequestDetailsDataCardProps = {
  title?: string;
  children: ReactNode;
};

type RequestDetailsRowProps = {
  label: string;
  value: ReactNode;
  valueClassName?: string;
};

type RequestDetailsPageFrameProps = {
  backHref: string;
  title: string;
  error: string;
  success: string;
  details: ReactNode;
  actions: ReactNode;
};

type ConsentAuditRowsProps = {
  audit: RequestConsentAuditFields;
};

export const REQUEST_STATUS_OPTIONS: StatusOption[] = [
  { value: "new", label: "Новая" },
  { value: "in_progress", label: "В работе" },
  { value: "closed", label: "Закрыта" },
];

export function getRequestStatusLabel(statusValue: RequestStatus | string): string {
  return (
    REQUEST_STATUS_OPTIONS.find((option) => option.value === statusValue)
      ?.label || statusValue
  );
}

export function RequestDetailsLoading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-[#1F3B73]">Загрузка...</div>
    </div>
  );
}

export function RequestDetailsNotFound({ message, backHref }: NotFoundProps) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <p className="text-neutral-600">{message}</p>
      <Link
        href={backHref}
        className="mt-3 inline-block text-[#1F3B73] hover:underline"
      >
        Вернуться к списку
      </Link>
    </div>
  );
}

export function RequestDetailsHeader({ backHref, title }: DetailsHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="min-w-0">
        <Link
          href={backHref}
          className="text-sm text-[#1F3B73] hover:underline"
        >
          ← Назад к списку
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[#1F3B73]">{title}</h1>
      </div>
    </div>
  );
}

export function RequestDetailsFeedback({ error, success }: FeedbackProps) {
  return <AdminFeedback error={error} success={success} />;
}

export function RequestDetailsStatusPanel({
  selectedStatus,
  onStatusChange,
  statusOptions,
  operatorComment,
  onOperatorCommentChange,
  onSave,
  saving,
  saveDisabled,
}: StatusPanelProps) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-[#1F3B73]">Обработка</h2>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Статус
          </label>
          <select
            value={selectedStatus}
            onChange={(event) => onStatusChange(event.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Комментарий оператора
          </label>
          <textarea
            rows={6}
            value={operatorComment}
            onChange={(event) => onOperatorCommentChange(event.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-[#1F3B73] focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled || saving}
          className="w-full rounded-xl bg-[#FF7A00] px-4 py-2 text-sm font-medium text-white hover:bg-[#e66e00] disabled:opacity-60"
        >
          {saving ? "Сохранение..." : "Сохранить изменения"}
        </button>
      </div>
    </div>
  );
}

export function RequestDetailsDataCard({
  title = "Данные заявки",
  children,
}: RequestDetailsDataCardProps) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-[#1F3B73]">{title}</h2>
      <dl className="space-y-3 text-sm">{children}</dl>
    </div>
  );
}

export function RequestDetailsRow({
  label,
  value,
  valueClassName,
}: RequestDetailsRowProps) {
  return (
    <div>
      <dt className="text-neutral-500">{label}</dt>
      <dd className={valueClassName}>{value}</dd>
    </div>
  );
}

export function RequestDetailsConsentAuditRows({
  audit,
}: ConsentAuditRowsProps) {
  return (
    <>
      <RequestDetailsRow
        label="Дата создания"
        value={new Date(audit.created_at).toLocaleString("ru-RU")}
      />
      <RequestDetailsRow
        label="Дата обновления"
        value={new Date(audit.updated_at).toLocaleString("ru-RU")}
      />
      <RequestDetailsRow
        label="Согласие 152-ФЗ"
        value={audit.consent_given ? "Да" : "Нет"}
      />
      <RequestDetailsRow
        label="Версия согласия"
        value={audit.consent_version || "—"}
      />
      <RequestDetailsRow
        label="Дата согласия"
        value={
          audit.consent_at
            ? new Date(audit.consent_at).toLocaleString("ru-RU")
            : "—"
        }
      />
      <RequestDetailsRow
        label="Текст согласия"
        value={audit.consent_text || "—"}
        valueClassName="whitespace-pre-wrap break-words"
      />
      <RequestDetailsRow label="IP" value={audit.ip_address || "—"} />
      <RequestDetailsRow
        label="User-Agent"
        value={audit.user_agent || "—"}
        valueClassName="break-all"
      />
    </>
  );
}

export function RequestDetailsPageFrame({
  backHref,
  title,
  error,
  success,
  details,
  actions,
}: RequestDetailsPageFrameProps) {
  return (
    <div>
      <RequestDetailsHeader backHref={backHref} title={title} />
      <RequestDetailsFeedback error={error} success={success} />
      <div className="grid gap-6 lg:grid-cols-2">
        {details}
        {actions}
      </div>
    </div>
  );
}
