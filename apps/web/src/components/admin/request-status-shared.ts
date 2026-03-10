export const BASIC_REQUEST_STATUS_OPTIONS = [
  { value: "new", label: "Новая" },
  { value: "in_progress", label: "В работе" },
  { value: "closed", label: "Закрыта" },
] as const;

type BasicRequestStatus = (typeof BASIC_REQUEST_STATUS_OPTIONS)[number]["value"];

const BASIC_REQUEST_STATUS_LABELS: Record<BasicRequestStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  closed: "Закрыта",
};

const BASIC_REQUEST_STATUS_COLORS: Record<BasicRequestStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  closed: "bg-green-100 text-green-700",
};

export function getBasicRequestStatusLabel(status: string): string {
  if (status in BASIC_REQUEST_STATUS_LABELS) {
    return BASIC_REQUEST_STATUS_LABELS[status as BasicRequestStatus];
  }
  return status;
}

export function getBasicRequestStatusColor(status: string): string {
  if (status in BASIC_REQUEST_STATUS_COLORS) {
    return BASIC_REQUEST_STATUS_COLORS[status as BasicRequestStatus];
  }
  return "bg-neutral-100 text-neutral-700";
}
