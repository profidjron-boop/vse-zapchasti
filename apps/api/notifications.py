from __future__ import annotations

from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
import json
import logging
import os
from pathlib import Path
import re
import smtplib
from typing import Any
from urllib.parse import urlsplit
import uuid

import httpx

logger = logging.getLogger("notifications")
WEBHOOK_ALLOWED_SCHEMES = {"https"}
LOCAL_WEBHOOK_HOSTS = {"localhost", "127.0.0.1", "::1"}

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_QUEUE_DIR = REPO_ROOT / "var" / "notifications"
QUEUE_PENDING_DIR = "pending"
QUEUE_DONE_DIR = "done"
QUEUE_FAILED_DIR = "failed"


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _serialize_dt(value: datetime) -> str:
    return value.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z")


def _parse_dt(value: str | None) -> datetime | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    try:
        parsed = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        return parsed.astimezone(UTC).replace(tzinfo=None)
    return parsed


def _positive_int(value: Any, default: int, minimum: int = 1, maximum: int = 10_000) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    if parsed < minimum:
        return minimum
    if parsed > maximum:
        return maximum
    return parsed


def _csv_env(name: str) -> list[str]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


def _bool_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _int_env(name: str, default: int, minimum: int = 1, maximum: int = 10_000) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    return _positive_int(raw, default, minimum=minimum, maximum=maximum)


def _resolve_channel_enabled(
    explicit_value: bool | None,
    env_name: str,
    *,
    default: bool = True,
) -> bool:
    if explicit_value is not None:
        return explicit_value
    return _bool_env(env_name, default)


def _resolve_queue_enabled(explicit_value: bool | None) -> bool:
    if explicit_value is not None:
        return explicit_value
    return _bool_env("NOTIFY_QUEUE_ENABLED", False)


def _resolve_retry_max_attempts(explicit_value: int | None) -> int:
    if explicit_value is not None:
        return _positive_int(explicit_value, default=5, minimum=1, maximum=20)
    return _int_env("NOTIFY_QUEUE_MAX_ATTEMPTS", default=5, minimum=1, maximum=20)


def _resolve_retry_delay_seconds(explicit_value: int | None) -> int:
    if explicit_value is not None:
        return _positive_int(explicit_value, default=300, minimum=10, maximum=86400)
    return _int_env("NOTIFY_QUEUE_RETRY_DELAY_SECONDS", default=300, minimum=10, maximum=86400)


def _load_webhook_allowlist() -> set[str]:
    return {item.lower() for item in _csv_env("NOTIFY_WEBHOOK_ALLOWED_HOSTS")}


def _is_allowed_webhook_host(host: str, allowed_hosts: set[str]) -> bool:
    if not allowed_hosts:
        return False
    host = host.lower()
    for allowed_host in allowed_hosts:
        if host == allowed_host or host.endswith(f".{allowed_host}"):
            return True
    return False


def _validate_webhook_url(url: str, allowed_hosts: set[str]) -> str:
    parsed = urlsplit(url)
    scheme = (parsed.scheme or "").lower()
    if parsed.username or parsed.password:
        raise ValueError("Webhook URL credentials are not allowed")

    host = (parsed.hostname or "").strip().lower()
    if not host:
        raise ValueError("Webhook host is required")

    allow_insecure_http = _bool_env("NOTIFY_ALLOW_INSECURE_HTTP_WEBHOOKS", False)
    if scheme == "http":
        if not allow_insecure_http:
            raise ValueError(
                "Webhook scheme 'http' is not allowed without NOTIFY_ALLOW_INSECURE_HTTP_WEBHOOKS=1"
            )
        if host not in LOCAL_WEBHOOK_HOSTS:
            raise ValueError(
                "Insecure http webhooks are allowed only for localhost hosts"
            )
    elif scheme not in WEBHOOK_ALLOWED_SCHEMES:
        raise ValueError(f"Webhook scheme '{scheme}' is not allowed")

    if not _is_allowed_webhook_host(host, allowed_hosts):
        raise ValueError(
            f"Webhook host '{host}' is not in NOTIFY_WEBHOOK_ALLOWED_HOSTS"
        )

    return parsed.geturl()


def _post_webhook(
    url: str, payload: dict[str, Any], *, timeout_seconds: float = 2.5
) -> None:
    with httpx.Client(timeout=timeout_seconds, follow_redirects=False) as client:
        response = client.post(url, json=payload)
    if response.status_code >= 400:
        raise RuntimeError(f"Webhook status {response.status_code}")


def _send_email(subject: str, body: str) -> None:
    smtp_host = os.getenv("NOTIFY_SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("NOTIFY_SMTP_PORT", "587"))
    smtp_user = os.getenv("NOTIFY_SMTP_USER", "").strip()
    smtp_password = os.getenv("NOTIFY_SMTP_PASSWORD", "")
    smtp_from = os.getenv("NOTIFY_EMAIL_FROM", smtp_user).strip()
    recipients = _csv_env("NOTIFY_EMAIL_TO")

    if not smtp_host or not smtp_from or not recipients:
        return

    message = EmailMessage()
    message["From"] = smtp_from
    message["To"] = ", ".join(recipients)
    message["Subject"] = subject
    message.set_content(body)

    use_tls = _bool_env("NOTIFY_SMTP_STARTTLS", True)
    with smtplib.SMTP(smtp_host, smtp_port, timeout=5) as smtp:
        if use_tls:
            smtp.starttls()
        if smtp_user and smtp_password:
            smtp.login(smtp_user, smtp_password)
        smtp.send_message(message)


def _notification_queue_root() -> Path:
    raw = os.getenv("NOTIFY_QUEUE_DIR", "").strip()
    if not raw:
        return DEFAULT_QUEUE_DIR
    queue_root = Path(raw).expanduser()
    if queue_root.is_absolute():
        return queue_root
    return (REPO_ROOT / queue_root).resolve()


def _ensure_queue_dirs() -> dict[str, Path]:
    root = _notification_queue_root()
    pending = root / QUEUE_PENDING_DIR
    done = root / QUEUE_DONE_DIR
    failed = root / QUEUE_FAILED_DIR
    pending.mkdir(parents=True, exist_ok=True)
    done.mkdir(parents=True, exist_ok=True)
    failed.mkdir(parents=True, exist_ok=True)
    return {
        "root": root,
        "pending": pending,
        "done": done,
        "failed": failed,
    }


def _safe_write_json(path: Path, payload: dict[str, Any]) -> None:
    tmp_path = path.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    tmp_path.replace(path)


class _SafeTemplateDict(dict[str, Any]):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def _event_template_suffix(event: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", event.strip().lower()).strip("_")
    return normalized.upper() or "GENERIC"


def _render_template(template: str, context: dict[str, Any]) -> str:
    if not template:
        return ""
    try:
        return template.format_map(_SafeTemplateDict(context))
    except Exception:
        return template


def _build_notification_message(event: str, payload: dict[str, Any]) -> dict[str, str]:
    template_suffix = _event_template_suffix(event)
    context = dict(payload)
    context.setdefault("event", event)
    context.setdefault("project", "vse-zapchasti")

    default_subject = f"[vse-zapchasti] {event}"
    default_body = json.dumps(payload, ensure_ascii=False, indent=2)
    default_short = json.dumps(payload, ensure_ascii=False)

    subject_template = (
        os.getenv(f"NOTIFY_TEMPLATE_EMAIL_SUBJECT_{template_suffix}", "").strip()
        or os.getenv("NOTIFY_TEMPLATE_EMAIL_SUBJECT_DEFAULT", "").strip()
        or default_subject
    )
    body_template = (
        os.getenv(f"NOTIFY_TEMPLATE_EMAIL_BODY_{template_suffix}", "").strip()
        or os.getenv("NOTIFY_TEMPLATE_EMAIL_BODY_DEFAULT", "").strip()
        or default_body
    )
    short_template = (
        os.getenv(f"NOTIFY_TEMPLATE_SHORT_{template_suffix}", "").strip()
        or os.getenv("NOTIFY_TEMPLATE_SHORT_DEFAULT", "").strip()
        or default_short
    )

    return {
        "subject": _render_template(subject_template, context),
        "body": _render_template(body_template, context),
        "short": _render_template(short_template, context),
    }


def _channel_ready_email() -> tuple[bool, str]:
    smtp_host = os.getenv("NOTIFY_SMTP_HOST", "").strip()
    smtp_user = os.getenv("NOTIFY_SMTP_USER", "").strip()
    smtp_from = os.getenv("NOTIFY_EMAIL_FROM", smtp_user).strip()
    recipients = _csv_env("NOTIFY_EMAIL_TO")
    if not smtp_host:
        return False, "NOTIFY_SMTP_HOST is empty"
    if not smtp_from:
        return False, "NOTIFY_EMAIL_FROM/NOTIFY_SMTP_USER is empty"
    if not recipients:
        return False, "NOTIFY_EMAIL_TO is empty"
    return True, "ok"


def _channel_ready_webhook(url: str, channel_name: str) -> tuple[bool, str]:
    if not url:
        return False, f"{channel_name} webhook URL is empty"
    try:
        _validate_webhook_url(url, _load_webhook_allowlist())
    except ValueError as exc:
        return False, str(exc)
    return True, "ok"


def get_notification_channels_health() -> dict[str, Any]:
    sms_url = os.getenv("NOTIFY_SMS_WEBHOOK_URL", "").strip()
    messenger_url = os.getenv("NOTIFY_MESSENGER_WEBHOOK_URL", "").strip()

    email_enabled = _bool_env("NOTIFY_EMAIL_ENABLED", True)
    sms_enabled = _bool_env("NOTIFY_SMS_ENABLED", True)
    messenger_enabled = _bool_env("NOTIFY_MESSENGER_ENABLED", True)
    queue_enabled = _bool_env("NOTIFY_QUEUE_ENABLED", False)

    email_ready, email_reason = _channel_ready_email()
    sms_ready, sms_reason = _channel_ready_webhook(sms_url, "SMS")
    messenger_ready, messenger_reason = _channel_ready_webhook(
        messenger_url,
        "Messenger",
    )

    queue_stats = get_notification_queue_stats()

    return {
        "queue": {
            "enabled": queue_enabled,
            **queue_stats,
        },
        "email": {
            "enabled": email_enabled,
            "ready": email_ready,
            "reason": email_reason,
        },
        "sms": {
            "enabled": sms_enabled,
            "ready": sms_ready,
            "reason": sms_reason,
        },
        "messenger": {
            "enabled": messenger_enabled,
            "ready": messenger_ready,
            "reason": messenger_reason,
        },
    }


def get_notification_queue_stats() -> dict[str, int]:
    queue_dirs = _ensure_queue_dirs()
    pending_files = [
        path
        for path in queue_dirs["pending"].glob("*.json")
        if path.is_file()
    ]
    due = 0
    now = _utcnow()
    for path in pending_files:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            due += 1
            continue
        next_retry = _parse_dt(str(payload.get("next_retry_at", "")))
        if next_retry is None or next_retry <= now:
            due += 1

    return {
        "pending": len(pending_files),
        "done": len(list(queue_dirs["done"].glob("*.json"))),
        "failed": len(list(queue_dirs["failed"].glob("*.json"))),
        "due": due,
    }


def _enqueue_notification_job(
    event: str,
    payload: dict[str, Any],
    *,
    email_enabled: bool,
    sms_enabled: bool,
    messenger_enabled: bool,
    retry_max_attempts: int,
    retry_delay_seconds: int,
) -> dict[str, Any]:
    queue_dirs = _ensure_queue_dirs()
    now = _utcnow()

    job_id = uuid.uuid4().hex
    job = {
        "id": job_id,
        "event": event,
        "payload": payload,
        "channels": {
            "email": bool(email_enabled),
            "sms": bool(sms_enabled),
            "messenger": bool(messenger_enabled),
        },
        "retry_attempt": 0,
        "max_attempts": retry_max_attempts,
        "retry_delay_seconds": retry_delay_seconds,
        "next_retry_at": _serialize_dt(now),
        "created_at": _serialize_dt(now),
        "last_error": "",
    }
    _safe_write_json(queue_dirs["pending"] / f"{job_id}.json", job)
    return job


def _deliver_notification(
    event: str,
    payload: dict[str, Any],
    *,
    email_enabled: bool,
    sms_enabled: bool,
    messenger_enabled: bool,
) -> list[str]:
    errors: list[str] = []
    message = _build_notification_message(event, payload)

    if email_enabled:
        try:
            _send_email(message["subject"], message["body"])
        except Exception as exc:
            logger.exception("email notification failed", extra={"event": event})
            errors.append(f"email: {exc}")

    sms_webhook_url = os.getenv("NOTIFY_SMS_WEBHOOK_URL", "").strip()
    webhook_allowed_hosts = _load_webhook_allowlist()
    if sms_enabled and sms_webhook_url:
        try:
            _post_webhook(
                _validate_webhook_url(sms_webhook_url, webhook_allowed_hosts),
                {
                    "channel": "sms",
                    "event": event,
                    "payload": payload,
                    "message": message["short"],
                },
            )
        except (RuntimeError, httpx.HTTPError, ValueError) as exc:
            logger.exception("sms notification failed", extra={"event": event})
            errors.append(f"sms: {exc}")

    messenger_webhook_url = os.getenv("NOTIFY_MESSENGER_WEBHOOK_URL", "").strip()
    if messenger_enabled and messenger_webhook_url:
        try:
            _post_webhook(
                _validate_webhook_url(messenger_webhook_url, webhook_allowed_hosts),
                {
                    "channel": "messenger",
                    "event": event,
                    "payload": payload,
                    "message": message["short"],
                },
            )
        except (RuntimeError, httpx.HTTPError, ValueError) as exc:
            logger.exception("messenger notification failed", extra={"event": event})
            errors.append(f"messenger: {exc}")

    return errors


def process_notification_queue(*, limit: int = 50) -> dict[str, int]:
    queue_dirs = _ensure_queue_dirs()
    now = _utcnow()
    processed = 0
    sent = 0
    retried = 0
    failed = 0

    for path in sorted(queue_dirs["pending"].glob("*.json")):
        if processed >= limit:
            break

        try:
            job = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            broken_target = queue_dirs["failed"] / path.name
            path.replace(broken_target)
            failed += 1
            processed += 1
            continue

        next_retry_at = _parse_dt(str(job.get("next_retry_at", "")))
        if next_retry_at and next_retry_at > now:
            continue

        channels = job.get("channels") if isinstance(job.get("channels"), dict) else {}
        errors = _deliver_notification(
            str(job.get("event", "notification.unknown")),
            job.get("payload") if isinstance(job.get("payload"), dict) else {},
            email_enabled=bool(channels.get("email", False)),
            sms_enabled=bool(channels.get("sms", False)),
            messenger_enabled=bool(channels.get("messenger", False)),
        )

        processed += 1

        if not errors:
            job["status"] = "sent"
            job["dispatched_at"] = _serialize_dt(now)
            _safe_write_json(queue_dirs["done"] / path.name, job)
            path.unlink(missing_ok=True)
            sent += 1
            continue

        max_attempts = _positive_int(job.get("max_attempts"), default=5, minimum=1, maximum=20)
        retry_attempt = _positive_int(job.get("retry_attempt"), default=0, minimum=0, maximum=max_attempts)
        retry_attempt += 1
        retry_delay_seconds = _positive_int(
            job.get("retry_delay_seconds"),
            default=300,
            minimum=10,
            maximum=86400,
        )
        job["retry_attempt"] = retry_attempt
        job["last_error"] = "; ".join(errors)[:2000]

        if retry_attempt >= max_attempts:
            job["status"] = "failed"
            job["failed_at"] = _serialize_dt(now)
            _safe_write_json(queue_dirs["failed"] / path.name, job)
            path.unlink(missing_ok=True)
            failed += 1
            continue

        job["status"] = "retry"
        job["next_retry_at"] = _serialize_dt(now + timedelta(seconds=retry_delay_seconds))
        _safe_write_json(path, job)
        retried += 1

    return {
        "processed": processed,
        "sent": sent,
        "retried": retried,
        "failed": failed,
    }


def notify_event(
    event: str,
    payload: dict[str, Any],
    *,
    enable_email: bool | None = None,
    enable_sms: bool | None = None,
    enable_messenger: bool | None = None,
    queue_enabled: bool | None = None,
    retry_max_attempts: int | None = None,
    retry_delay_seconds: int | None = None,
) -> None:
    """Best-effort notifications. Never raises to caller."""
    email_enabled = _resolve_channel_enabled(
        enable_email, "NOTIFY_EMAIL_ENABLED", default=True
    )
    sms_enabled = _resolve_channel_enabled(enable_sms, "NOTIFY_SMS_ENABLED", default=True)
    messenger_enabled = _resolve_channel_enabled(
        enable_messenger, "NOTIFY_MESSENGER_ENABLED", default=True
    )

    if not email_enabled and not sms_enabled and not messenger_enabled:
        return

    should_enqueue = _resolve_queue_enabled(queue_enabled)
    resolved_retry_max_attempts = _resolve_retry_max_attempts(retry_max_attempts)
    resolved_retry_delay_seconds = _resolve_retry_delay_seconds(retry_delay_seconds)

    if should_enqueue:
        _enqueue_notification_job(
            event,
            payload,
            email_enabled=email_enabled,
            sms_enabled=sms_enabled,
            messenger_enabled=messenger_enabled,
            retry_max_attempts=resolved_retry_max_attempts,
            retry_delay_seconds=resolved_retry_delay_seconds,
        )
        return

    _deliver_notification(
        event,
        payload,
        email_enabled=email_enabled,
        sms_enabled=sms_enabled,
        messenger_enabled=messenger_enabled,
    )
