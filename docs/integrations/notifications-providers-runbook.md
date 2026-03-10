# Notifications Providers Runbook

Date: 2026-03-10
Scope: Email / SMS / Messenger provider wiring for production

## 1. What is already implemented
- Feature flags in admin (`/admin/integrations`):
  - global notifications on/off
  - channels: email/sms/messenger
  - queue+retry on/off and retry parameters
- API endpoints for operations:
  - `GET /api/admin/integrations/notifications/health`
  - `POST /api/admin/integrations/notifications/test`
- Queue worker in API process:
  - background processing of pending jobs
  - retry policy
  - done/failed buckets

## 2. Required environment variables

### 2.1 Email
- `NOTIFY_EMAIL_ENABLED=1`
- `NOTIFY_SMTP_HOST=<smtp-host>`
- `NOTIFY_SMTP_PORT=587`
- `NOTIFY_SMTP_USER=<user>`
- `NOTIFY_SMTP_PASSWORD=<secret>`
- `NOTIFY_EMAIL_FROM=<from@domain>` (or fallback to `NOTIFY_SMTP_USER`)
- `NOTIFY_EMAIL_TO=<ops@domain,manager@domain>`
- `NOTIFY_SMTP_STARTTLS=1`

### 2.2 SMS webhook
- `NOTIFY_SMS_ENABLED=1`
- `NOTIFY_SMS_WEBHOOK_URL=https://<provider>/...`
- `NOTIFY_WEBHOOK_ALLOWED_HOSTS=<provider-host>`

### 2.3 Messenger webhook
- `NOTIFY_MESSENGER_ENABLED=1`
- `NOTIFY_MESSENGER_WEBHOOK_URL=https://<provider>/...`
- `NOTIFY_WEBHOOK_ALLOWED_HOSTS=<provider-hosts-comma-separated>`

### 2.4 Queue / retry
- `NOTIFY_QUEUE_ENABLED=1`
- `NOTIFY_QUEUE_MAX_ATTEMPTS=5`
- `NOTIFY_QUEUE_RETRY_DELAY_SECONDS=300`
- `NOTIFY_QUEUE_DIR=var/notifications` (optional override)
- `NOTIFICATION_QUEUE_BACKGROUND_ENABLED=1`
- `NOTIFICATION_QUEUE_POLL_SECONDS=20`

## 3. Optional templates
Template keys can be defined globally or per-event.

- Per-event suffix format: uppercase event with non-alnum replaced by `_`.
- Example for event `admin.notifications.test` -> suffix `ADMIN_NOTIFICATIONS_TEST`.

Available vars in template context:
- all payload fields
- `event`
- `project`

Template env keys:
- `NOTIFY_TEMPLATE_EMAIL_SUBJECT_DEFAULT`
- `NOTIFY_TEMPLATE_EMAIL_BODY_DEFAULT`
- `NOTIFY_TEMPLATE_SHORT_DEFAULT`
- `NOTIFY_TEMPLATE_EMAIL_SUBJECT_<SUFFIX>`
- `NOTIFY_TEMPLATE_EMAIL_BODY_<SUFFIX>`
- `NOTIFY_TEMPLATE_SHORT_<SUFFIX>`

## 4. Verification checklist
1. Open `/admin/integrations` and enable required flags.
2. Save configuration.
3. Run health endpoint:
   - `GET /api/admin/integrations/notifications/health`
   - verify `ready=true` for intended channels.
4. Run test-send endpoint:
   - `POST /api/admin/integrations/notifications/test`
   - verify response `status=ok`.
5. Confirm provider side delivery logs.

## 5. Troubleshooting
- Health says webhook host not allowed:
  - update `NOTIFY_WEBHOOK_ALLOWED_HOSTS`.
- Queue pending grows and not consumed:
  - check `NOTIFICATION_QUEUE_BACKGROUND_ENABLED=1`.
  - check API process logs for `notifications_queue_worker_error`.
- Email not sent:
  - verify SMTP host/from/to and credentials.
  - confirm network egress/firewall.

## 6. Security notes
- All provider credentials must be in env/secrets manager only.
- No credentials in repository or static content.
- Use HTTPS webhooks in production.

