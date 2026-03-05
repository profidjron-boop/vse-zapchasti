from __future__ import annotations

from email.message import EmailMessage
import json
import logging
import os
import smtplib
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request


logger = logging.getLogger("notifications")


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


def _post_webhook(url: str, payload: dict[str, Any], *, timeout_seconds: float = 2.5) -> None:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib_request.Request(
        url=url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib_request.urlopen(req, timeout=timeout_seconds) as response:
        status = getattr(response, "status", None) or response.getcode()
        if status >= 400:
            raise RuntimeError(f"Webhook status {status}")


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
    if sms_webhook_url:
        try:
            _post_webhook(
                sms_webhook_url,
                {
                    "channel": "sms",
                    "event": event,
                    "payload": payload,
                },
            )
        except (RuntimeError, urllib_error.URLError, ValueError):
            logger.exception("sms notification failed", extra={"event": event})

    messenger_webhook_url = os.getenv("NOTIFY_MESSENGER_WEBHOOK_URL", "").strip()
    if messenger_webhook_url:
        try:
            _post_webhook(
                messenger_webhook_url,
                {
                    "channel": "messenger",
                    "event": event,
                    "payload": payload,
                },
            )
        except (RuntimeError, urllib_error.URLError, ValueError):
            logger.exception("messenger notification failed", extra={"event": event})

