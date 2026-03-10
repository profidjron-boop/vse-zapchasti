# Production Metadata Draft — 2026-03-09

Назначение: рабочий драфт перед финальным заполнением `docs/project-handoff-2026-03-09.md`.
Статус: автозаполнено по фактам репозитория + отмечены поля, где нужно подтверждение заказчика.

## 1) Владение и ответственность
- Product owner (ФИО, контакт): Сергей (контакт уточнить)
- Technical owner (ФИО, контакт): Сергей (CTO, контакт уточнить)
- On-call / incident contact (24/7 или рабочее окно): Сергей (временно), канал/окно подтвердить
- Кто утверждает релиз: Сергей (CTO), подтвердить финально

## 2) Серверы и окружения
| Окружение | Host/IP | Роль | Провайдер | Доступ (SSH/VPN) | Ответственный |
|---|---|---|---|---|---|
| Production | TBD | web/api runtime (Next.js + FastAPI) | Linux VPS (РФ), Docker Compose + Nginx TLS | SSH keys/VPN (подтвердить) | Сергей (подтвердить) |
| Production DB | TBD | Postgres 15+ | VPS managed/self-hosted (подтвердить) | private network + DB ACL (подтвердить) | Сергей (подтвердить) |
| Staging (если есть) | TBD | optional staging | TBD | TBD | TBD |

## 3) Домены и DNS
| Домен | Назначение | Регистратор | DNS-провайдер | TTL | Ответственный |
|---|---|---|---|---|---|
| `vsezapchasti.ru` (или факт. домен) | public web | TBD | TBD | TBD | Сергей/заказчик (подтвердить) |
| `api.vsezapchasti.ru` (или факт. домен) | api/admin | TBD | TBD | TBD | Сергей/заказчик (подтвердить) |

## 4) Доступы к системам
| Система | URL/адрес | Метод доступа | Кому выдано | Дата последней проверки |
|---|---|---|---|---|
| Admin UI | `https://<site>/admin/login` | email/password + role (`admin/manager/service_manager`) | TBD | TBD |
| API admin auth | `https://<api>/api/admin/auth/token` | OAuth2 password/token flow | TBD | TBD |
| Postgres | `DATABASE_URL` (prod) | DB creds + network ACL | TBD | TBD |
| CI/CD | `.github/workflows/release-check.yml`, `.github/workflows/verify-all.yml` | GitHub/Runner access | TBD | TBD |
| Backup storage | `backups/postgres/*` (минимум), рекомендуется object storage в РФ | FS/object storage access | TBD | TBD |
| DNS panel | регистратор/DNS provider account | account-based access | TBD | TBD |

## 5) Secrets и интеграции
| Группа | Переменные | Где хранятся | Ротация | Ответственный |
|---|---|---|---|---|
| JWT/Auth | `JWT_SECRET_KEY`, `JWT_PREVIOUS_SECRET_KEY` (optional), admin bootstrap creds | env/secret store (`.env` 600 или Vault) | каждые 90 дней или при инциденте (подтвердить) | Сергей (подтвердить) |
| DB | `DATABASE_URL` | env/secret store | каждые 180 дней или при инциденте (подтвердить) | Сергей (подтвердить) |
| Redis/rate-limit | `REDIS_URL` / `RATE_LIMIT_REDIS_URL` | env/secret store | при смене инфраструктуры/инциденте | Сергей (подтвердить) |
| Notifications | `NOTIFY_SMTP_*`, `NOTIFY_EMAIL_*`, `NOTIFY_SMS_WEBHOOK_URL`, `NOTIFY_MESSENGER_WEBHOOK_URL`, `NOTIFY_WEBHOOK_ALLOWED_HOSTS` | env/secret store | по политике провайдера/при инциденте | Сергей + заказчик (подтвердить) |

## 6) Policy/SLA
- Release window: предложено `пн-пт 10:00-18:00 (Asia/Krasnoyarsk)`, подтвердить
- RTO / RPO: предложено `RTO 4h / RPO 24h`, подтвердить
- Incident severity matrix: предложено `S1/S2/S3`, подтвердить формализацию
- Escalation path (L1/L2/L3): предложено `L1 support -> L2 technical owner -> L3 CTO`, подтвердить контакты

## 7) Технические gate-проверки перед подписью
1. Release readiness (green):
   - `RELEASE_REQUIRE_ADMIN_SMOKE=1 SMOKE_ADMIN_BOOTSTRAP=1 SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... bash scripts/release-check.sh`
2. Handoff metadata completeness (должно быть green):
   - `RELEASE_REQUIRE_HANDOFF_METADATA=1 bash scripts/release-check.sh --skip-write-smoke`
3. Проверить, что `docs/project-handoff-2026-03-09.md` не содержит production placeholders.

## 8) Где обновить после заполнения
1. `docs/project-handoff-2026-03-09.md` (разделы 3.1-3.4 и 9).
2. `docs/project-state.md` (риски/evidence после успешного strict handoff gate).
3. При необходимости `docs/project-state.md` (последний статус handoff metadata gate и release evidence).

## 9) Минимум, что еще нужно от заказчика (без этого не закрыть handoff)
1. Фактические домены, DNS-регистратор и провайдер DNS.
2. Фактические production host/IP и провайдер хостинга.
3. Список ответственных и контактов (owner/on-call/release approver).
4. Кому и когда выданы доступы (admin/api/db/ci/backup/dns).
5. Утвержденные SLA/RTO/RPO и escalation contacts.
