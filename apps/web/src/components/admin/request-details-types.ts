export type RequestStatus = "new" | "in_progress" | "closed";

export type RequestConsentAuditFields = {
  consent_given: boolean;
  consent_version: string | null;
  consent_text: string | null;
  consent_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
};
