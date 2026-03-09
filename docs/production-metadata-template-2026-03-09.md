# Production Metadata Template — 2026-03-09

Назначение: заполнить недостающие операционные данные перед финальным подписанием handoff.

## 1) Владение и ответственность
- Product owner (ФИО, контакт):
- Technical owner (ФИО, контакт):
- On-call / incident contact (24/7 или рабочее окно):
- Кто утверждает релиз:

## 2) Серверы и окружения
| Окружение | Host/IP | Роль | Провайдер | Доступ (SSH/VPN) | Ответственный |
|---|---|---|---|---|---|
| Production |  | web/api runtime |  |  |  |
| Production DB |  | Postgres |  |  |  |
| Staging (если есть) |  |  |  |  |  |

## 3) Домены и DNS
| Домен | Назначение | Регистратор | DNS-провайдер | TTL | Ответственный |
|---|---|---|---|---|---|
|  | public web |  |  |  |  |
|  | api/admin |  |  |  |  |

## 4) Доступы к системам
| Система | URL/адрес | Метод доступа | Кому выдано | Дата последней проверки |
|---|---|---|---|---|
| Admin UI |  | email/password + role |  |  |
| API admin auth |  | token/password flow |  |  |
| Postgres |  | DB creds + network ACL |  |  |
| CI/CD |  | GitHub/Runner access |  |  |
| Backup storage |  | object storage / FS |  |  |
| DNS panel |  | registrar/DNS access |  |  |

## 5) Secrets и интеграции
| Группа | Переменные | Где хранятся | Ротация | Ответственный |
|---|---|---|---|---|
| JWT/Auth | `JWT_SECRET_KEY`, admin bootstrap creds |  |  |  |
| DB | `DATABASE_URL` |  |  |  |
| Redis/rate-limit | `REDIS_URL` / `RATE_LIMIT_REDIS_URL` |  |  |  |
| Notifications | `NOTIFY_SMTP_*`, `NOTIFY_EMAIL_*`, `NOTIFY_SMS_WEBHOOK_URL`, `NOTIFY_MESSENGER_WEBHOOK_URL`, `NOTIFY_WEBHOOK_ALLOWED_HOSTS` |  |  |  |

## 6) Policy/SLA
- Release window:
- RTO / RPO:
- Incident severity matrix:
- Escalation path (L1/L2/L3):

## 7) Перед подписанием handoff — обязательный чек
1. Заполнены все таблицы в этом файле.
2. Проверены и подтверждены актуальные доступы у ответственных.
3. Выполнен свежий `scripts/release-check.sh` с сохранением логов.
4. Обновлён `docs/project-handoff-2026-03-09.md` фактическими production данными.
5. Зафиксирована дата/ответственные приёмки.
