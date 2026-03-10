"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  redirectIfAdminUnauthorized,
  toAdminErrorMessage,
} from "@/components/admin/api-error";
import { getClientApiBaseUrl, withApiBase } from "@/lib/api-base-url";
import { ApiRequestError, fetchJsonWithTimeout } from "@/lib/fetch-json";

type ContentBlock = {
  key: string;
  value: string | null;
  type: "text" | "image" | "html";
  description: string | null;
};

type IntegrationSettings = {
  feature_erp_source_import_enabled: boolean;
  feature_erp_online_sync_enabled: boolean;
  feature_erp_sync_delta_enabled: boolean;
  feature_erp_sync_retry_enabled: boolean;
  integration_erp_source_url: string;
  integration_erp_source_allowed_hosts: string;
  integration_erp_sync_schedule_minutes: string;
  integration_erp_sync_retry_max_attempts: string;
  integration_erp_sync_retry_delay_seconds: string;
  feature_notifications_enabled: boolean;
  feature_notifications_email_enabled: boolean;
  feature_notifications_sms_enabled: boolean;
  feature_notifications_messenger_enabled: boolean;
  feature_notifications_queue_enabled: boolean;
  integration_notifications_retry_max_attempts: string;
  integration_notifications_retry_delay_seconds: string;
  feature_service_prepayment_enabled: boolean;
  feature_service_payment_flow_enabled: boolean;
  feature_service_payment_block_unpaid_enabled: boolean;
  integration_payments_provider_name: string;
  integration_payments_default_currency: string;
};

type ErpSyncStatus = {
  online_sync_enabled: boolean;
  source_import_enabled: boolean;
  update_mode: string;
  schedule_minutes: number;
  delta_enabled: boolean;
  retry_enabled: boolean;
  retry_max_attempts: number;
  retry_delay_seconds: number;
  last_status: string | null;
  last_run_id: number | null;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  retry_attempt: number;
  next_retry_at: string | null;
  next_scheduled_at: string | null;
  latest_source_run: {
    id: number;
    status: string;
    source: string | null;
    started_at: string | null;
    finished_at: string | null;
    created: number;
    updated: number;
    failed: number;
    errors_count: number;
    error_preview: string[];
  } | null;
  recent_failed_runs: Array<{
    id: number;
    status: string;
    source: string | null;
    started_at: string | null;
    finished_at: string | null;
    created: number;
    updated: number;
    failed: number;
    errors_count: number;
    error_preview: string[];
  }>;
};

type ErpSyncRunResponse = {
  status: string;
  run_id: number | null;
  created: number;
  updated: number;
  failed: number;
  delta_since?: string | null;
};

type NotificationsHealth = {
  queue: {
    enabled: boolean;
    pending: number;
    done: number;
    failed: number;
    due: number;
  };
  email: { enabled: boolean; ready: boolean; reason: string };
  sms: { enabled: boolean; ready: boolean; reason: string };
  messenger: { enabled: boolean; ready: boolean; reason: string };
  features: {
    enabled: boolean;
    email: boolean;
    sms: boolean;
    messenger: boolean;
    queue_enabled: boolean;
    retry_max_attempts: number;
    retry_delay_seconds: number;
  };
};

type NotificationsTestResponse = {
  status: string;
  channel: string;
  queue_enabled: boolean;
  queue_processed: { processed: number; sent: number; retried: number; failed: number } | null;
};

type PaymentsHealth = {
  features: {
    prepayment_enabled: boolean;
    payment_flow_enabled: boolean;
    payment_block_unpaid_enabled: boolean;
    provider_name: string;
    default_currency: string;
  };
  provider_name: string;
  default_currency: string;
  webhook_endpoint: string;
  webhook_token_configured: boolean;
};

const DEFAULT_SETTINGS: IntegrationSettings = {
  feature_erp_source_import_enabled: true,
  feature_erp_online_sync_enabled: false,
  feature_erp_sync_delta_enabled: false,
  feature_erp_sync_retry_enabled: true,
  integration_erp_source_url: "",
  integration_erp_source_allowed_hosts: "",
  integration_erp_sync_schedule_minutes: "60",
  integration_erp_sync_retry_max_attempts: "5",
  integration_erp_sync_retry_delay_seconds: "300",
  feature_notifications_enabled: true,
  feature_notifications_email_enabled: true,
  feature_notifications_sms_enabled: true,
  feature_notifications_messenger_enabled: true,
  feature_notifications_queue_enabled: false,
  integration_notifications_retry_max_attempts: "5",
  integration_notifications_retry_delay_seconds: "300",
  feature_service_prepayment_enabled: false,
  feature_service_payment_flow_enabled: false,
  feature_service_payment_block_unpaid_enabled: false,
  integration_payments_provider_name: "",
  integration_payments_default_currency: "RUB",
};

const SETTINGS_META: Record<
  keyof IntegrationSettings,
  { type: "text"; description: string }
> = {
  feature_erp_source_import_enabled: {
    type: "text",
    description: "Feature flag: разрешить импорт из 1С/ERP источника",
  },
  feature_erp_online_sync_enabled: {
    type: "text",
    description: "Feature flag: включить online-sync 1С/ERP (планировщик + ручной запуск)",
  },
  feature_erp_sync_delta_enabled: {
    type: "text",
    description: "Feature flag: включить delta-режим 1С/ERP sync (updated_since)",
  },
  feature_erp_sync_retry_enabled: {
    type: "text",
    description: "Feature flag: включить retry-механику 1С/ERP sync",
  },
  integration_erp_source_url: {
    type: "text",
    description: "URL источника 1С/ERP для import-from-source",
  },
  integration_erp_source_allowed_hosts: {
    type: "text",
    description: "Allowlist хостов источника 1С/ERP (через запятую)",
  },
  integration_erp_sync_schedule_minutes: {
    type: "text",
    description: "Интервал планового online-sync в минутах",
  },
  integration_erp_sync_retry_max_attempts: {
    type: "text",
    description: "Максимум retry-попыток online-sync",
  },
  integration_erp_sync_retry_delay_seconds: {
    type: "text",
    description: "Пауза между retry-попытками online-sync (секунды)",
  },
  feature_notifications_enabled: {
    type: "text",
    description: "Feature flag: включить уведомления (глобально)",
  },
  feature_notifications_email_enabled: {
    type: "text",
    description: "Feature flag: включить канал Email уведомлений",
  },
  feature_notifications_sms_enabled: {
    type: "text",
    description: "Feature flag: включить канал SMS уведомлений",
  },
  feature_notifications_messenger_enabled: {
    type: "text",
    description: "Feature flag: включить канал мессенджера",
  },
  feature_notifications_queue_enabled: {
    type: "text",
    description: "Feature flag: включить очередь и retry обработку уведомлений",
  },
  integration_notifications_retry_max_attempts: {
    type: "text",
    description: "Максимум retry попыток для очереди уведомлений",
  },
  integration_notifications_retry_delay_seconds: {
    type: "text",
    description: "Пауза между retry попытками очереди уведомлений (секунды)",
  },
  feature_service_prepayment_enabled: {
    type: "text",
    description: "Feature flag: включить отображение предоплаты в сервисе",
  },
  feature_service_payment_flow_enabled: {
    type: "text",
    description: "Feature flag: включить payment-flow для сервис-заявок",
  },
  feature_service_payment_block_unpaid_enabled: {
    type: "text",
    description: "Feature flag: блокировать переход сервис-заявки без оплаты",
  },
  integration_payments_provider_name: {
    type: "text",
    description: "Название платежного провайдера для payment-flow",
  },
  integration_payments_default_currency: {
    type: "text",
    description: "Валюта payment-flow по умолчанию (например RUB)",
  },
};

function parseBoolean(value: string | null | undefined, fallback: boolean): boolean {
  if (value === null || value === undefined) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function booleanToStoredValue(value: boolean): string {
  return value ? "1" : "0";
}

function normalizeIntString(
  value: string,
  fallback: number,
  minValue: number,
  maxValue: number,
): string {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed)) return String(fallback);
  if (parsed < minValue) return String(minValue);
  if (parsed > maxValue) return String(maxValue);
  return String(parsed);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ru-RU");
}

function getSetupBadge(isReady: boolean): {
  label: string;
  className: string;
} {
  if (isReady) {
    return {
      label: "Готово",
      className:
        "rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700",
    };
  }
  return {
    label: "Требует настройки",
    className:
      "rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700",
  };
}

async function upsertContentValue(
  apiBaseUrl: string,
  key: string,
  value: string,
  description: string,
): Promise<void> {
  try {
    await fetchJsonWithTimeout<ContentBlock>(
      withApiBase(apiBaseUrl, `/api/admin/content/${encodeURIComponent(key)}`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value,
          type: "text",
          description,
        }),
      },
      12000,
    );
  } catch (updateError) {
    if (!(updateError instanceof ApiRequestError) || updateError.status !== 404) {
      throw updateError;
    }
    await fetchJsonWithTimeout<ContentBlock>(
      withApiBase(apiBaseUrl, "/api/admin/content"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          value,
          type: "text",
          description,
        }),
      },
      12000,
    );
  }
}

export default function AdminIntegrationsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<IntegrationSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] =
    useState<IntegrationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [erpSyncStatus, setErpSyncStatus] = useState<ErpSyncStatus | null>(null);
  const [erpSyncStatusError, setErpSyncStatusError] = useState("");
  const [erpSyncRunMessage, setErpSyncRunMessage] = useState("");
  const [isLoadingSyncStatus, setIsLoadingSyncStatus] = useState(false);
  const [isRunningSync, setIsRunningSync] = useState(false);
  const [notificationsHealth, setNotificationsHealth] =
    useState<NotificationsHealth | null>(null);
  const [notificationsHealthError, setNotificationsHealthError] = useState("");
  const [notificationsTestMessage, setNotificationsTestMessage] = useState("");
  const [isLoadingNotificationsHealth, setIsLoadingNotificationsHealth] =
    useState(false);
  const [isSendingNotificationsTest, setIsSendingNotificationsTest] =
    useState(false);
  const [paymentsHealth, setPaymentsHealth] = useState<PaymentsHealth | null>(null);
  const [paymentsHealthError, setPaymentsHealthError] = useState("");
  const [isLoadingPaymentsHealth, setIsLoadingPaymentsHealth] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [savedSettings, settings],
  );
  const erpSetupReady = useMemo(
    () =>
      settings.feature_erp_source_import_enabled &&
      settings.integration_erp_source_url.trim().length > 0,
    [
      settings.feature_erp_source_import_enabled,
      settings.integration_erp_source_url,
    ],
  );
  const notificationsSetupReady = useMemo(
    () =>
      settings.feature_notifications_enabled &&
      (settings.feature_notifications_email_enabled ||
        settings.feature_notifications_sms_enabled ||
        settings.feature_notifications_messenger_enabled),
    [
      settings.feature_notifications_enabled,
      settings.feature_notifications_email_enabled,
      settings.feature_notifications_sms_enabled,
      settings.feature_notifications_messenger_enabled,
    ],
  );
  const paymentsSetupReady = useMemo(
    () =>
      !settings.feature_service_payment_flow_enabled ||
      (settings.integration_payments_provider_name.trim().length > 0 &&
        settings.integration_payments_default_currency.trim().length > 0),
    [
      settings.feature_service_payment_flow_enabled,
      settings.integration_payments_provider_name,
      settings.integration_payments_default_currency,
    ],
  );
  const erpBadge = getSetupBadge(erpSetupReady);
  const notificationsBadge = getSetupBadge(notificationsSetupReady);
  const paymentsBadge = getSetupBadge(paymentsSetupReady);

  function applyErpPreset(mode: "manual" | "hourly" | "daily") {
    setSettings((prev) => ({
      ...prev,
      feature_erp_source_import_enabled: true,
      feature_erp_online_sync_enabled: mode !== "manual",
      feature_erp_sync_delta_enabled: mode !== "manual",
      feature_erp_sync_retry_enabled: true,
      integration_erp_sync_schedule_minutes:
        mode === "daily" ? "1440" : "60",
      integration_erp_sync_retry_max_attempts: prev.integration_erp_sync_retry_max_attempts || "5",
      integration_erp_sync_retry_delay_seconds: prev.integration_erp_sync_retry_delay_seconds || "300",
    }));
    setSuccess("");
  }

  function applyNotificationsPreset(mode: "emailOnly" | "allChannels" | "off") {
    setSettings((prev) => ({
      ...prev,
      feature_notifications_enabled: mode !== "off",
      feature_notifications_email_enabled:
        mode === "emailOnly" || mode === "allChannels",
      feature_notifications_sms_enabled: mode === "allChannels",
      feature_notifications_messenger_enabled: mode === "allChannels",
      feature_notifications_queue_enabled: mode === "allChannels",
    }));
    setSuccess("");
  }

  function applyPaymentsPreset(mode: "off" | "prepayment" | "strict") {
    setSettings((prev) => ({
      ...prev,
      feature_service_prepayment_enabled: mode !== "off",
      feature_service_payment_flow_enabled: mode !== "off",
      feature_service_payment_block_unpaid_enabled: mode === "strict",
      integration_payments_default_currency:
        prev.integration_payments_default_currency || "RUB",
    }));
    setSuccess("");
  }

  const loadErpSyncStatus = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setIsLoadingSyncStatus(true);
      }
      setErpSyncStatusError("");
      try {
        const apiBaseUrl = getClientApiBaseUrl();
        const payload = await fetchJsonWithTimeout<ErpSyncStatus>(
          withApiBase(apiBaseUrl, "/api/admin/integrations/erp-sync/status"),
          {},
          12000,
        );
        setErpSyncStatus(payload);
      } catch (statusError) {
        if (redirectIfAdminUnauthorized(statusError, router)) {
          return;
        }
        setErpSyncStatusError(
          toAdminErrorMessage(
            statusError,
            "Не удалось загрузить статус online-sync",
          ),
        );
      } finally {
        setIsLoadingSyncStatus(false);
      }
    },
    [router],
  );

  const loadNotificationsHealth = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setIsLoadingNotificationsHealth(true);
      }
      setNotificationsHealthError("");
      try {
        const apiBaseUrl = getClientApiBaseUrl();
        const payload = await fetchJsonWithTimeout<NotificationsHealth>(
          withApiBase(apiBaseUrl, "/api/admin/integrations/notifications/health"),
          {},
          12000,
        );
        setNotificationsHealth(payload);
      } catch (healthError) {
        if (redirectIfAdminUnauthorized(healthError, router)) {
          return;
        }
        setNotificationsHealthError(
          toAdminErrorMessage(
            healthError,
            "Не удалось загрузить health уведомлений",
          ),
        );
      } finally {
        setIsLoadingNotificationsHealth(false);
      }
    },
    [router],
  );

  const loadPaymentsHealth = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setIsLoadingPaymentsHealth(true);
      }
      setPaymentsHealthError("");
      try {
        const apiBaseUrl = getClientApiBaseUrl();
        const payload = await fetchJsonWithTimeout<PaymentsHealth>(
          withApiBase(apiBaseUrl, "/api/admin/integrations/payments/health"),
          {},
          12000,
        );
        setPaymentsHealth(payload);
      } catch (healthError) {
        if (redirectIfAdminUnauthorized(healthError, router)) {
          return;
        }
        setPaymentsHealthError(
          toAdminErrorMessage(healthError, "Не удалось загрузить health платежей"),
        );
      } finally {
        setIsLoadingPaymentsHealth(false);
      }
    },
    [router],
  );

  const loadSettings = useCallback(async () => {
    setError("");
    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const blocks = await fetchJsonWithTimeout<ContentBlock[]>(
        withApiBase(apiBaseUrl, "/api/admin/content"),
        {},
        12000,
      );
      const byKey = new Map(blocks.map((item) => [item.key, item.value]));
      const nextSettings: IntegrationSettings = {
        feature_erp_source_import_enabled: parseBoolean(
          byKey.get("feature_erp_source_import_enabled"),
          DEFAULT_SETTINGS.feature_erp_source_import_enabled,
        ),
        feature_erp_online_sync_enabled: parseBoolean(
          byKey.get("feature_erp_online_sync_enabled"),
          DEFAULT_SETTINGS.feature_erp_online_sync_enabled,
        ),
        feature_erp_sync_delta_enabled: parseBoolean(
          byKey.get("feature_erp_sync_delta_enabled"),
          DEFAULT_SETTINGS.feature_erp_sync_delta_enabled,
        ),
        feature_erp_sync_retry_enabled: parseBoolean(
          byKey.get("feature_erp_sync_retry_enabled"),
          DEFAULT_SETTINGS.feature_erp_sync_retry_enabled,
        ),
        integration_erp_source_url:
          byKey.get("integration_erp_source_url") ??
          DEFAULT_SETTINGS.integration_erp_source_url,
        integration_erp_source_allowed_hosts:
          byKey.get("integration_erp_source_allowed_hosts") ??
          DEFAULT_SETTINGS.integration_erp_source_allowed_hosts,
        integration_erp_sync_schedule_minutes:
          byKey.get("integration_erp_sync_schedule_minutes") ??
          DEFAULT_SETTINGS.integration_erp_sync_schedule_minutes,
        integration_erp_sync_retry_max_attempts:
          byKey.get("integration_erp_sync_retry_max_attempts") ??
          DEFAULT_SETTINGS.integration_erp_sync_retry_max_attempts,
        integration_erp_sync_retry_delay_seconds:
          byKey.get("integration_erp_sync_retry_delay_seconds") ??
          DEFAULT_SETTINGS.integration_erp_sync_retry_delay_seconds,
        feature_notifications_enabled: parseBoolean(
          byKey.get("feature_notifications_enabled"),
          DEFAULT_SETTINGS.feature_notifications_enabled,
        ),
        feature_notifications_email_enabled: parseBoolean(
          byKey.get("feature_notifications_email_enabled"),
          DEFAULT_SETTINGS.feature_notifications_email_enabled,
        ),
        feature_notifications_sms_enabled: parseBoolean(
          byKey.get("feature_notifications_sms_enabled"),
          DEFAULT_SETTINGS.feature_notifications_sms_enabled,
        ),
        feature_notifications_messenger_enabled: parseBoolean(
          byKey.get("feature_notifications_messenger_enabled"),
          DEFAULT_SETTINGS.feature_notifications_messenger_enabled,
        ),
        feature_notifications_queue_enabled: parseBoolean(
          byKey.get("feature_notifications_queue_enabled"),
          DEFAULT_SETTINGS.feature_notifications_queue_enabled,
        ),
        integration_notifications_retry_max_attempts:
          byKey.get("integration_notifications_retry_max_attempts") ??
          DEFAULT_SETTINGS.integration_notifications_retry_max_attempts,
        integration_notifications_retry_delay_seconds:
          byKey.get("integration_notifications_retry_delay_seconds") ??
          DEFAULT_SETTINGS.integration_notifications_retry_delay_seconds,
        feature_service_prepayment_enabled: parseBoolean(
          byKey.get("feature_service_prepayment_enabled"),
          DEFAULT_SETTINGS.feature_service_prepayment_enabled,
        ),
        feature_service_payment_flow_enabled: parseBoolean(
          byKey.get("feature_service_payment_flow_enabled"),
          DEFAULT_SETTINGS.feature_service_payment_flow_enabled,
        ),
        feature_service_payment_block_unpaid_enabled: parseBoolean(
          byKey.get("feature_service_payment_block_unpaid_enabled"),
          DEFAULT_SETTINGS.feature_service_payment_block_unpaid_enabled,
        ),
        integration_payments_provider_name:
          byKey.get("integration_payments_provider_name") ??
          DEFAULT_SETTINGS.integration_payments_provider_name,
        integration_payments_default_currency:
          byKey.get("integration_payments_default_currency") ??
          DEFAULT_SETTINGS.integration_payments_default_currency,
      };

      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      await loadErpSyncStatus();
      await loadNotificationsHealth();
      await loadPaymentsHealth();
    } catch (loadError) {
      if (redirectIfAdminUnauthorized(loadError, router)) {
        return;
      }
      setError(
        toAdminErrorMessage(
          loadError,
          "Не удалось загрузить конфигурацию интеграций",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [loadErpSyncStatus, loadNotificationsHealth, loadPaymentsHealth, router]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function handleSave() {
    setError("");
    setSuccess("");
    setIsSaving(true);
    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const normalizedScheduleMinutes = normalizeIntString(
        settings.integration_erp_sync_schedule_minutes,
        60,
        1,
        10080,
      );
      const normalizedRetryMaxAttempts = normalizeIntString(
        settings.integration_erp_sync_retry_max_attempts,
        5,
        1,
        20,
      );
      const normalizedRetryDelaySeconds = normalizeIntString(
        settings.integration_erp_sync_retry_delay_seconds,
        300,
        10,
        86400,
      );
      const normalizedNotificationsRetryMaxAttempts = normalizeIntString(
        settings.integration_notifications_retry_max_attempts,
        5,
        1,
        20,
      );
      const normalizedNotificationsRetryDelaySeconds = normalizeIntString(
        settings.integration_notifications_retry_delay_seconds,
        300,
        10,
        86400,
      );
      const normalizedPaymentsDefaultCurrency = (
        settings.integration_payments_default_currency || "RUB"
      )
        .trim()
        .toUpperCase()
        .slice(0, 10);
      const payloadByKey: Record<keyof IntegrationSettings, string> = {
        feature_erp_source_import_enabled: booleanToStoredValue(
          settings.feature_erp_source_import_enabled,
        ),
        feature_erp_online_sync_enabled: booleanToStoredValue(
          settings.feature_erp_online_sync_enabled,
        ),
        feature_erp_sync_delta_enabled: booleanToStoredValue(
          settings.feature_erp_sync_delta_enabled,
        ),
        feature_erp_sync_retry_enabled: booleanToStoredValue(
          settings.feature_erp_sync_retry_enabled,
        ),
        integration_erp_source_url: settings.integration_erp_source_url.trim(),
        integration_erp_source_allowed_hosts:
          settings.integration_erp_source_allowed_hosts.trim(),
        integration_erp_sync_schedule_minutes: normalizedScheduleMinutes,
        integration_erp_sync_retry_max_attempts: normalizedRetryMaxAttempts,
        integration_erp_sync_retry_delay_seconds: normalizedRetryDelaySeconds,
        feature_notifications_enabled: booleanToStoredValue(
          settings.feature_notifications_enabled,
        ),
        feature_notifications_email_enabled: booleanToStoredValue(
          settings.feature_notifications_email_enabled,
        ),
        feature_notifications_sms_enabled: booleanToStoredValue(
          settings.feature_notifications_sms_enabled,
        ),
        feature_notifications_messenger_enabled: booleanToStoredValue(
          settings.feature_notifications_messenger_enabled,
        ),
        feature_notifications_queue_enabled: booleanToStoredValue(
          settings.feature_notifications_queue_enabled,
        ),
        integration_notifications_retry_max_attempts:
          normalizedNotificationsRetryMaxAttempts,
        integration_notifications_retry_delay_seconds:
          normalizedNotificationsRetryDelaySeconds,
        feature_service_prepayment_enabled: booleanToStoredValue(
          settings.feature_service_prepayment_enabled,
        ),
        feature_service_payment_flow_enabled: booleanToStoredValue(
          settings.feature_service_payment_flow_enabled,
        ),
        feature_service_payment_block_unpaid_enabled: booleanToStoredValue(
          settings.feature_service_payment_block_unpaid_enabled,
        ),
        integration_payments_provider_name:
          settings.integration_payments_provider_name.trim(),
        integration_payments_default_currency: normalizedPaymentsDefaultCurrency,
      };

      const keys = Object.keys(payloadByKey) as (keyof IntegrationSettings)[];
      for (const key of keys) {
        await upsertContentValue(
          apiBaseUrl,
          key,
          payloadByKey[key],
          SETTINGS_META[key].description,
        );
      }

      const normalizedSettings: IntegrationSettings = {
        ...settings,
        integration_erp_sync_schedule_minutes: normalizedScheduleMinutes,
        integration_erp_sync_retry_max_attempts: normalizedRetryMaxAttempts,
        integration_erp_sync_retry_delay_seconds: normalizedRetryDelaySeconds,
        integration_notifications_retry_max_attempts:
          normalizedNotificationsRetryMaxAttempts,
        integration_notifications_retry_delay_seconds:
          normalizedNotificationsRetryDelaySeconds,
        integration_payments_default_currency: normalizedPaymentsDefaultCurrency,
      };
      setSettings(normalizedSettings);
      setSavedSettings(normalizedSettings);
      setSuccess("Настройки сохранены");
      await loadErpSyncStatus();
      await loadNotificationsHealth();
      await loadPaymentsHealth();
    } catch (saveError) {
      if (redirectIfAdminUnauthorized(saveError, router)) {
        return;
      }
      setError(toAdminErrorMessage(saveError, "Не удалось сохранить настройки"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRunErpSync() {
    setErpSyncRunMessage("");
    setErpSyncStatusError("");
    setIsRunningSync(true);
    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const payload = await fetchJsonWithTimeout<ErpSyncRunResponse>(
        withApiBase(apiBaseUrl, "/api/admin/integrations/erp-sync/run"),
        {
          method: "POST",
        },
        12000,
      );
      setErpSyncRunMessage(
        `Запуск #${payload.run_id ?? "—"}: создано ${payload.created}, обновлено ${payload.updated}, ошибок ${payload.failed}`,
      );
      await loadErpSyncStatus();
    } catch (runError) {
      if (redirectIfAdminUnauthorized(runError, router)) {
        return;
      }
      setErpSyncStatusError(
        toAdminErrorMessage(runError, "Не удалось запустить online-sync"),
      );
    } finally {
      setIsRunningSync(false);
    }
  }

  async function handleSendNotificationsTest() {
    setNotificationsHealthError("");
    setNotificationsTestMessage("");
    setIsSendingNotificationsTest(true);
    try {
      const apiBaseUrl = getClientApiBaseUrl();
      const payload = await fetchJsonWithTimeout<NotificationsTestResponse>(
        withApiBase(apiBaseUrl, "/api/admin/integrations/notifications/test"),
        {
          method: "POST",
        },
        12000,
      );
      const queuePart = payload.queue_processed
        ? ` queue: processed=${payload.queue_processed.processed}, sent=${payload.queue_processed.sent}, retried=${payload.queue_processed.retried}, failed=${payload.queue_processed.failed}`
        : "";
      setNotificationsTestMessage(
        `Тест уведомлений отправлен (channel=${payload.channel}, queue=${payload.queue_enabled ? "on" : "off"}).${queuePart}`,
      );
      await loadNotificationsHealth();
    } catch (testError) {
      if (redirectIfAdminUnauthorized(testError, router)) {
        return;
      }
      setNotificationsHealthError(
        toAdminErrorMessage(testError, "Не удалось отправить тест уведомлений"),
      );
    } finally {
      setIsSendingNotificationsTest(false);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-neutral-600">
        Загрузка настроек интеграций...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1F3B73]">
              Интеграции и функции
            </h1>
            <p className="mt-2 text-sm text-neutral-600">
              Настройка в формате «включил и работает»: без правок кода.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isDirty || isSaving}
            className="rounded-xl bg-[#1F3B73] px-4 py-2 text-sm font-semibold text-white hover:bg-[#27498a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Сохраняем..." : "Сохранить конфигурацию"}
          </button>
        </div>
        {error ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </p>
        ) : null}
        <div className="mt-4 rounded-xl border border-[#1F3B73]/15 bg-[#1F3B73]/5 p-4">
          <p className="text-sm font-semibold text-[#1F3B73]">
            Порядок настройки (просто по шагам)
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-neutral-700">
            <li>Ниже выберите готовый режим кнопкой.</li>
            <li>Заполните только поля URL/Провайдер/Валюта.</li>
            <li>Нажмите «Сохранить конфигурацию».</li>
          </ol>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-neutral-800">1С / ERP</p>
              <span className={erpBadge.className}>{erpBadge.label}</span>
            </div>
            <p className="mt-2 text-xs text-neutral-600">
              Импорт каталога и автосинхронизация.
            </p>
            <a
              href="#integrations-erp"
              className="mt-2 inline-block text-xs font-medium text-[#1F3B73] hover:underline"
            >
              Перейти к настройке →
            </a>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-neutral-800">Уведомления</p>
              <span className={notificationsBadge.className}>
                {notificationsBadge.label}
              </span>
            </div>
            <p className="mt-2 text-xs text-neutral-600">
              Email/SMS/мессенджер и тест отправки.
            </p>
            <a
              href="#integrations-notifications"
              className="mt-2 inline-block text-xs font-medium text-[#1F3B73] hover:underline"
            >
              Перейти к настройке →
            </a>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-neutral-800">
                Предоплата сервиса
              </p>
              <span className={paymentsBadge.className}>{paymentsBadge.label}</span>
            </div>
            <p className="mt-2 text-xs text-neutral-600">
              Статусы оплаты и webhook.
            </p>
            <a
              href="#integrations-payments"
              className="mt-2 inline-block text-xs font-medium text-[#1F3B73] hover:underline"
            >
              Перейти к настройке →
            </a>
          </div>
        </div>
      </section>

      <section
        id="integrations-erp"
        className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#1F3B73]">1С / ERP</h2>
          <span className={erpBadge.className}>{erpBadge.label}</span>
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          Импорт каталога из 1С/ERP и автосинхронизация по расписанию.
        </p>
        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-sm font-medium text-neutral-800">Готовые режимы</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyErpPreset("manual")}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Только ручной импорт
            </button>
            <button
              type="button"
              onClick={() => applyErpPreset("hourly")}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Автосинхронизация каждый час
            </button>
            <button
              type="button"
              onClick={() => applyErpPreset("daily")}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Автосинхронизация каждый день
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-600">
            Обязательно заполнить: <span className="font-semibold">URL источника</span>.
          </p>
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={settings.feature_erp_source_import_enabled}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                feature_erp_source_import_enabled: event.target.checked,
              }))
            }
            className="h-4 w-4 accent-[#1F3B73]"
          />
          Разрешить импорт из источника 1С/ERP
        </label>
        <label className="mt-3 flex items-center gap-3 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={settings.feature_erp_online_sync_enabled}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                feature_erp_online_sync_enabled: event.target.checked,
              }))
            }
            className="h-4 w-4 accent-[#1F3B73]"
          />
          Включить online-sync (scheduler + ручной запуск)
        </label>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-neutral-700">
            <span className="mb-1 block">URL источника</span>
            <input
              value={settings.integration_erp_source_url}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  integration_erp_source_url: event.target.value,
                }))
              }
              placeholder="https://erp.example/export/products.xlsx"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-[#1F3B73] focus:ring-2 focus:ring-[#1F3B73]/20"
            />
          </label>
          <label className="text-sm text-neutral-700">
            <span className="mb-1 block">Allowlist хостов</span>
            <input
              value={settings.integration_erp_source_allowed_hosts}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  integration_erp_source_allowed_hosts: event.target.value,
                }))
              }
              placeholder="erp.example, api.erp.example"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-[#1F3B73] focus:ring-2 focus:ring-[#1F3B73]/20"
            />
          </label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-neutral-700">
            <span className="mb-1 block">Интервал sync (минуты)</span>
            <input
              type="number"
              min={1}
              max={10080}
              value={settings.integration_erp_sync_schedule_minutes}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  integration_erp_sync_schedule_minutes: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-[#1F3B73] focus:ring-2 focus:ring-[#1F3B73]/20"
            />
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={settings.feature_erp_sync_delta_enabled}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  feature_erp_sync_delta_enabled: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#1F3B73]"
            />
            Delta-режим (`updated_since`)
          </label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={settings.feature_erp_sync_retry_enabled}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  feature_erp_sync_retry_enabled: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#1F3B73]"
            />
            Retry при ошибках sync
          </label>
          <label className="text-sm text-neutral-700">
            <span className="mb-1 block">Макс. retry</span>
            <input
              type="number"
              min={1}
              max={20}
              value={settings.integration_erp_sync_retry_max_attempts}
              disabled={!settings.feature_erp_sync_retry_enabled}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  integration_erp_sync_retry_max_attempts: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-[#1F3B73] focus:ring-2 focus:ring-[#1F3B73]/20 disabled:bg-neutral-100"
            />
          </label>
          <label className="text-sm text-neutral-700">
            <span className="mb-1 block">Пауза retry (сек)</span>
            <input
              type="number"
              min={10}
              max={86400}
              value={settings.integration_erp_sync_retry_delay_seconds}
              disabled={!settings.feature_erp_sync_retry_enabled}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  integration_erp_sync_retry_delay_seconds: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-[#1F3B73] focus:ring-2 focus:ring-[#1F3B73]/20 disabled:bg-neutral-100"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadErpSyncStatus(true)}
            disabled={isLoadingSyncStatus}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
          >
            {isLoadingSyncStatus ? "Обновляем..." : "Обновить статус sync"}
          </button>
          <button
            type="button"
            onClick={() => void handleRunErpSync()}
            disabled={isRunningSync || !settings.feature_erp_online_sync_enabled}
            className="rounded-xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#27498a] disabled:opacity-60"
          >
            {isRunningSync ? "Запуск..." : "Запустить sync сейчас"}
          </button>
        </div>
        {erpSyncRunMessage ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {erpSyncRunMessage}
          </p>
        ) : null}
        {erpSyncStatusError ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {erpSyncStatusError}
          </p>
        ) : null}
        {erpSyncStatus ? (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <span className="font-medium">Статус синхронизации:</span>{" "}
                {erpSyncStatus.last_status || "—"}
              </div>
              <div>
                <span className="font-medium">Номер запуска:</span>{" "}
                {erpSyncStatus.last_run_id ?? "—"}
              </div>
              <div>
                <span className="font-medium">Последний запуск:</span>{" "}
                {formatDateTime(erpSyncStatus.last_run_at)}
              </div>
              <div>
                <span className="font-medium">Последний успех:</span>{" "}
                {formatDateTime(erpSyncStatus.last_success_at)}
              </div>
              <div>
                <span className="font-medium">Следующий автозапуск:</span>{" "}
                {formatDateTime(erpSyncStatus.next_scheduled_at)}
              </div>
              <div>
                <span className="font-medium">Следующая повторная попытка:</span>{" "}
                {formatDateTime(erpSyncStatus.next_retry_at)}
              </div>
            </div>
            {erpSyncStatus.last_error ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                <span className="font-medium">Последняя ошибка:</span>{" "}
                {erpSyncStatus.last_error}
              </p>
            ) : null}
            {erpSyncStatus.recent_failed_runs.length > 0 ? (
              <div className="mt-3">
                <p className="mb-2 font-medium text-neutral-800">
                  Последние ошибки sync
                </p>
                <ul className="space-y-1 text-xs text-neutral-600">
                  {erpSyncStatus.recent_failed_runs.slice(0, 5).map((run) => (
                    <li key={run.id}>
                      #{run.id} · {formatDateTime(run.started_at)} ·{" "}
                      {run.error_preview[0] || "Ошибка без текста"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        <details className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <summary className="cursor-pointer text-xs font-medium text-neutral-700">
            Технические параметры (для DevOps)
          </summary>
          <p className="mt-2 text-xs text-neutral-500">
            Секреты хранятся только в ENV: `IMPORT_SOURCE_AUTH_HEADER`,
            `IMPORT_SOURCE_USERNAME`, `IMPORT_SOURCE_PASSWORD`.
          </p>
        </details>
        <Link
          href="/admin/imports"
          className="mt-4 inline-block text-sm font-medium text-[#1F3B73] hover:underline"
        >
          Перейти к импортам →
        </Link>
      </section>

      <section
        id="integrations-notifications"
        className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#1F3B73]">Уведомления</h2>
          <span className={notificationsBadge.className}>
            {notificationsBadge.label}
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          Настройка каналов связи и проверка отправки тестового сообщения.
        </p>
        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-sm font-medium text-neutral-800">Готовые режимы</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyNotificationsPreset("emailOnly")}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Только Email
            </button>
            <button
              type="button"
              onClick={() => applyNotificationsPreset("allChannels")}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Все каналы + очередь
            </button>
            <button
              type="button"
              onClick={() => applyNotificationsPreset("off")}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Выключить уведомления
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-3 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={settings.feature_notifications_enabled}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  feature_notifications_enabled: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#1F3B73]"
            />
            Включить уведомления глобально
          </label>
          <label className="flex items-center gap-3 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={settings.feature_notifications_email_enabled}
              disabled={!settings.feature_notifications_enabled}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  feature_notifications_email_enabled: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#1F3B73]"
            />
            Email
          </label>
          <label className="flex items-center gap-3 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={settings.feature_notifications_sms_enabled}
              disabled={!settings.feature_notifications_enabled}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  feature_notifications_sms_enabled: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#1F3B73]"
            />
            SMS
          </label>
          <label className="flex items-center gap-3 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={settings.feature_notifications_messenger_enabled}
              disabled={!settings.feature_notifications_enabled}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  feature_notifications_messenger_enabled: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#1F3B73]"
            />
            Мессенджер
          </label>
          <label className="flex items-center gap-3 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={settings.feature_notifications_queue_enabled}
              disabled={!settings.feature_notifications_enabled}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  feature_notifications_queue_enabled: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#1F3B73]"
            />
            Очередь уведомлений + retry
          </label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-neutral-700">
            <span className="mb-1 block">Макс. retry попыток</span>
            <input
              type="number"
              min={1}
              max={20}
              value={settings.integration_notifications_retry_max_attempts}
              disabled={
                !settings.feature_notifications_enabled ||
                !settings.feature_notifications_queue_enabled
              }
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  integration_notifications_retry_max_attempts:
                    event.target.value,
                }))
              }
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-[#1F3B73] focus:ring-2 focus:ring-[#1F3B73]/20 disabled:bg-neutral-100"
            />
          </label>
          <label className="text-sm text-neutral-700">
            <span className="mb-1 block">Пауза retry (сек)</span>
            <input
              type="number"
              min={10}
              max={86400}
              value={settings.integration_notifications_retry_delay_seconds}
              disabled={
                !settings.feature_notifications_enabled ||
                !settings.feature_notifications_queue_enabled
              }
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  integration_notifications_retry_delay_seconds:
                    event.target.value,
                }))
              }
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-[#1F3B73] focus:ring-2 focus:ring-[#1F3B73]/20 disabled:bg-neutral-100"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadNotificationsHealth(true)}
            disabled={isLoadingNotificationsHealth}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
          >
            {isLoadingNotificationsHealth
              ? "Обновляем..."
              : "Проверить health"}
          </button>
          <button
            type="button"
            onClick={() => void handleSendNotificationsTest()}
            disabled={
              isSendingNotificationsTest || !settings.feature_notifications_enabled
            }
            className="rounded-xl bg-[#1F3B73] px-4 py-2 text-sm font-medium text-white hover:bg-[#27498a] disabled:opacity-60"
          >
            {isSendingNotificationsTest
              ? "Отправка..."
              : "Тест отправки уведомлений"}
          </button>
        </div>
        {notificationsTestMessage ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notificationsTestMessage}
          </p>
        ) : null}
        {notificationsHealthError ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {notificationsHealthError}
          </p>
        ) : null}
        {notificationsHealth ? (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <span className="font-medium">В очереди:</span>{" "}
                {notificationsHealth.queue.pending}
              </div>
              <div>
                <span className="font-medium">Готово к отправке:</span>{" "}
                {notificationsHealth.queue.due}
              </div>
              <div>
                <span className="font-medium">Ошибки очереди:</span>{" "}
                {notificationsHealth.queue.failed}
              </div>
              <div>
                <span className="font-medium">Успешно отправлено:</span>{" "}
                {notificationsHealth.queue.done}
              </div>
              <div>
                <span className="font-medium">Email:</span>{" "}
                {notificationsHealth.email.ready ? "готово" : "ошибка"}
              </div>
              <div>
                <span className="font-medium">SMS:</span>{" "}
                {notificationsHealth.sms.ready ? "готово" : "ошибка"}
              </div>
              <div>
                <span className="font-medium">Мессенджер:</span>{" "}
                {notificationsHealth.messenger.ready ? "готово" : "ошибка"}
              </div>
              <div>
                <span className="font-medium">Очередь:</span>{" "}
                {notificationsHealth.features.queue_enabled ? "включена" : "выключена"}
              </div>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Email: {notificationsHealth.email.reason}; SMS:{" "}
              {notificationsHealth.sms.reason}; Messenger:{" "}
              {notificationsHealth.messenger.reason}
            </p>
          </div>
        ) : null}
        <details className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <summary className="cursor-pointer text-xs font-medium text-neutral-700">
            Технические параметры (для DevOps)
          </summary>
          <p className="mt-2 text-xs text-neutral-500">
            Секреты провайдеров задаются через ENV: `NOTIFY_SMTP_*`,
            `NOTIFY_SMS_WEBHOOK_URL`, `NOTIFY_MESSENGER_WEBHOOK_URL`.
          </p>
        </details>
      </section>

      <section
        id="integrations-payments"
        className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#1F3B73]">
            Предоплата сервиса
          </h2>
          <span className={paymentsBadge.className}>{paymentsBadge.label}</span>
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          Включение payment-flow для сервис-заявок с webhook обработкой
          `pending/paid/failed/refunded`.
        </p>
        <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-sm font-medium text-neutral-800">Готовые режимы</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPaymentsPreset("off")}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Без предоплаты
            </button>
            <button
              type="button"
              onClick={() => applyPaymentsPreset("prepayment")}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Предоплата без блокировки
            </button>
            <button
              type="button"
              onClick={() => applyPaymentsPreset("strict")}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Предоплата с блокировкой
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-600">
            Обязательно заполнить для payment-flow:{" "}
            <span className="font-semibold">Провайдер</span> и{" "}
            <span className="font-semibold">Валюта</span>.
          </p>
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={settings.feature_service_prepayment_enabled}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                feature_service_prepayment_enabled: event.target.checked,
              }))
            }
            className="h-4 w-4 accent-[#1F3B73]"
          />
          Включить отображение предоплаты на сайте
        </label>
        <label className="mt-3 flex items-center gap-3 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={settings.feature_service_payment_flow_enabled}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                feature_service_payment_flow_enabled: event.target.checked,
              }))
            }
            className="h-4 w-4 accent-[#1F3B73]"
          />
          Включить payment-flow (статусы оплаты + webhook)
        </label>
        <label className="mt-3 flex items-center gap-3 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={settings.feature_service_payment_block_unpaid_enabled}
            disabled={!settings.feature_service_payment_flow_enabled}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                feature_service_payment_block_unpaid_enabled:
                  event.target.checked,
              }))
            }
            className="h-4 w-4 accent-[#1F3B73]"
          />
          Блокировать переход сервис-заявки без оплаты
        </label>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-neutral-700">
            <span className="mb-1 block">Провайдер</span>
            <input
              value={settings.integration_payments_provider_name}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  integration_payments_provider_name: event.target.value,
                }))
              }
              placeholder="YooKassa / Tinkoff / Uniteller"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:border-[#1F3B73] focus:ring-2 focus:ring-[#1F3B73]/20"
            />
          </label>
          <label className="text-sm text-neutral-700">
            <span className="mb-1 block">Валюта по умолчанию</span>
            <input
              value={settings.integration_payments_default_currency}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  integration_payments_default_currency: event.target.value,
                }))
              }
              placeholder="RUB"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 uppercase outline-none focus:border-[#1F3B73] focus:ring-2 focus:ring-[#1F3B73]/20"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadPaymentsHealth(true)}
            disabled={isLoadingPaymentsHealth}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
          >
            {isLoadingPaymentsHealth ? "Обновляем..." : "Проверить health"}
          </button>
        </div>
        {paymentsHealthError ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {paymentsHealthError}
          </p>
        ) : null}
        {paymentsHealth ? (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <span className="font-medium">Webhook endpoint:</span>{" "}
                {paymentsHealth.webhook_endpoint}
              </div>
              <div>
                <span className="font-medium">Webhook token:</span>{" "}
                {paymentsHealth.webhook_token_configured
                  ? "настроен"
                  : "не настроен"}
              </div>
              <div>
                <span className="font-medium">Payment flow:</span>{" "}
                {paymentsHealth.features.payment_flow_enabled
                  ? "включен"
                  : "выключен"}
              </div>
              <div>
                <span className="font-medium">Блок неоплаченных:</span>{" "}
                {paymentsHealth.features.payment_block_unpaid_enabled
                  ? "включен"
                  : "выключен"}
              </div>
              <div>
                <span className="font-medium">Provider:</span>{" "}
                {paymentsHealth.provider_name}
              </div>
              <div>
                <span className="font-medium">Currency:</span>{" "}
                {paymentsHealth.default_currency}
              </div>
            </div>
          </div>
        ) : null}
        <details className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <summary className="cursor-pointer text-xs font-medium text-neutral-700">
            Технические параметры (для DevOps)
          </summary>
          <p className="mt-2 text-xs text-neutral-500">
            Секрет webhook хранится в ENV: `PAYMENTS_WEBHOOK_TOKEN`.
            Легальный контур (54-ФЗ/чеки/возвраты) настраивается отдельно.
          </p>
        </details>
      </section>
    </div>
  );
}
