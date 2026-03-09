# Production Metadata Draft — 2026-03-09

Назначение: рабочий драфт перед финальным заполнением `docs/project-handoff-2026-03-09.md`.

## 1) Владение и ответственность
- Product owner (ФИО, контакт): Сергей (уточнить контакт)
- Technical owner (ФИО, контакт): Сергей (CTO, уточнить контакт)
- On-call / incident contact (24/7 или рабочее окно): TBD
- Кто утверждает релиз: TBD

## 2) Серверы и окружения
| Окружение | Host/IP | Роль | Провайдер | Доступ (SSH/VPN) | Ответственный |
|---|---|---|---|---|---|
| Production | TBD | web/api runtime | TBD | TBD | TBD |
| Production DB | TBD | Postgres | TBD | TBD | TBD |
| Staging (если есть) | TBD | TBD | TBD | TBD | TBD |

## 3) Домены и DNS
| Домен | Назначение | Регистратор | DNS-провайдер | TTL | Ответственный |
|---|---|---|---|---|---|
| TBD | public web | TBD | TBD | TBD | TBD |
| TBD | api/admin | TBD | TBD | TBD | TBD |

## 4) Доступы к системам
| Система | URL/адрес | Метод доступа | Кому выдано | Дата последней проверки |
|---|---|---|---|---|
| Admin UI | `<site>/admin/login` | email/password + role | TBD | TBD |
| API admin auth | `<api>/api/admin/auth/token` | token/password flow | TBD | TBD |
| Postgres | `DATABASE_URL` (prod) | DB creds + network ACL | TBD | TBD |
| CI/CD | `.github/workflows/release-check.yml`, `.github/workflows/verify-all.yml` | GitHub/Runner access | TBD | TBD |
| Backup storage | `backups/postgres/*` (policy path, локально) | FS/object storage access | TBD | TBD |
| DNS panel | registrar/DNS access | account-based access | TBD | TBD |

## 5) Secrets и интеграции
| Группа | Переменные | Где хранятся | Ротация | Ответственный |
|---|---|---|---|---|
| JWT/Auth | `JWT_SECRET_KEY`, `JWT_PREVIOUS_SECRET_KEY` (optional), admin bootstrap creds | TBD | TBD | TBD |
| DB | `DATABASE_URL` | TBD | TBD | TBD |
| Redis/rate-limit | `REDIS_URL` / `RATE_LIMIT_REDIS_URL` | TBD | TBD | TBD |
| Notifications | `NOTIFY_SMTP_*`, `NOTIFY_EMAIL_*`, `NOTIFY_SMS_WEBHOOK_URL`, `NOTIFY_MESSENGER_WEBHOOK_URL`, `NOTIFY_WEBHOOK_ALLOWED_HOSTS` | TBD | TBD | TBD |

## 6) Policy/SLA
- Release window: TBD
- RTO / RPO: TBD
- Incident severity matrix: TBD
- Escalation path (L1/L2/L3): TBD

## 7) Технические gate-проверки перед подписью
1. Release readiness (green):
   - `RELEASE_REQUIRE_ADMIN_SMOKE=1 SMOKE_ADMIN_BOOTSTRAP=1 SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... bash scripts/release-check.sh`
2. Handoff metadata completeness (должно быть green):
   - `RELEASE_REQUIRE_HANDOFF_METADATA=1 bash scripts/release-check.sh --skip-write-smoke`
3. Проверить, что `docs/project-handoff-2026-03-09.md` не содержит production placeholders.

## 8) Где обновить после заполнения
1. `docs/project-handoff-2026-03-09.md` (разделы 3.1-3.4 и 9).
2. `docs/project-state.md` (риски/evidence после успешного strict handoff gate).
3. При необходимости `docs/chat-context.md` (последний статус handoff metadata gate).
