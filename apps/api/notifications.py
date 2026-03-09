from __future__ import annotations

from email.message import EmailMessage
import json
import logging
import os
import smtplib
from typing import Any
from urllib.parse import urlsplit

import httpx


logger = logging.getLogger("notifications")
WEBHOOK_ALLOWED_SCHEMES = {"https", "http"}


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
    if scheme not in WEBHOOK_ALLOWED_SCHEMES:
        raise ValueError(f"Webhook scheme '{scheme}' is not allowed")

    host = (parsed.hostname or "").strip().lower()
    if not host:
        raise ValueError("Webhook host is required")

    if not _is_allowed_webhook_host(host, allowed_hosts):
        raise ValueError(f"Webhook host '{host}' is not in NOTIFY_WEBHOOK_ALLOWED_HOSTS")

    return parsed.geturl()


def _post_webhook(url: str, payload: dict[str, Any], *, timeout_seconds: float = 2.5) -> None:
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


def notify_event(event: str, payload: dict[str, Any]) -> None:
    """Best-effort notifications. Never raises to caller."""
    try:
        subject = f"[vse-zapchasti] {event}"
        body = json.dumps(payload, ensure_ascii=False, indent=2)
        _send_email(subject, body)
    except Exception:
        logger.exception("email notification failed", extra={"event": event})

    sms_webhook_url = os.getenv("NOTIFY_SMS_WEBHOOK_URL", "").strip()
    webhook_allowed_hosts = _load_webhook_allowlist()

    if sms_webhook_url:
        try:
            _post_webhook(
                _validate_webhook_url(sms_webhook_url, webhook_allowed_hosts),
                {
                    "channel": "sms",
                    "event": event,
                    "payload": payload,
                },
            )
        except (RuntimeError, httpx.HTTPError, ValueError):
            logger.exception("sms notification failed", extra={"event": event})

    messenger_webhook_url = os.getenv("NOTIFY_MESSENGER_WEBHOOK_URL", "").strip()
    if messenger_webhook_url:
        try:
            _post_webhook(
                _validate_webhook_url(messenger_webhook_url, webhook_allowed_hosts),
                {
                    "channel": "messenger",
                    "event": event,
                    "payload": payload,
                },
            )
        except (RuntimeError, httpx.HTTPError, ValueError):
            logger.exception("messenger notification failed", extra={"event": event})
