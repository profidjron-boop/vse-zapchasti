# Project State — vse-zapchasti

Версия: v1.1
Дата: 2026-03-10
Ответственный: Сергей (CTO)

## 1) Project Identity
- Project: Все запчасти
- Client: internal
- Project type: existing repo / e-commerce + service booking
- Stage: pre-prod release candidate
- Status: active
- Owner: Сергей
- Current date: 2026-03-10
- Last updated: 2026-03-10 15:48 (Asia/Krasnoyarsk)

## 2) Source Of Truth Now
- Current governing artifact: repo truth + requirements v1.1 + handoff pack + release evidence
- Artifact version: handoff pack 2026-03-10
- Approved by: Сергей
- Approval date: pending formal customer sign-off
- Precedence: repo truth + approved scope

## 3) Approved Artifacts
- Brief: scope-fixed in `docs/requirements.md`
- TZ: covered by `docs/tz-implementation-matrix-2026-03-09.md`
- Build Plan: execution trace in repo + gates docs
- Estimate: partial (финальная коммерческая оценка вне репозитория)
- Repo execution scope: yes
- Release evidence: yes
- Handoff pack: yes (ready for sign-off)
- Artifacts list:
  - `docs/audit-closure-2026-03-09.md` — audit closure recorded
  - `docs/tz-gap-report-2026-03-09.md` — фактический gap-check по ТЗ v1.1
  - `docs/tz-implementation-matrix-2026-03-09.md` — детальная матрица соответствия ТЗ по разделам 1–15
  - `docs/verify-gates.md` — current verify/release gates
  - `docs/project-handoff-2026-03-09.md` — handoff pack (metadata strict gate passes)

## 4) Approved Scope
- In scope:
  - hardening + release-readiness for existing repo
  - security/dependency/coverage/runtime gates
  - reproducible release path with backup/restore/smoke
- Out of scope:
  - new product modules beyond approved hardening scope
  - large-scale refactor of stable legacy flows without explicit need
- Fixed constraints:
  - РФ only
  - 152-ФЗ baseline
  - no-CDN runtime
- Non-negotiables:
  - verify gates green
  - release evidence reproducible

## 5) Current Delivery Shape
- Current slice: hardening + TZ conformance evidence
- Slice objective: подтвердить фактическое соответствие v1.1 и закрытие audit-tail пунктов
- Current milestone: verify/runtime/release strict gates green
- Next milestone: внедренческий этап по интеграционно-зависимым пунктам

## 6) Blocking Open Questions
- none for current code/release scope

## 7) Current Risks
- Risk level: LOW-MEDIUM
- Risks:
  - 1С/ERP online sync adapter не включён (только import-first + source trigger)
  - провайдеры уведомлений (Email/SMS/мессенджер) требуют прод-подключения
  - предоплата сервиса требует отдельного платёжного контура (54-ФЗ/возвраты/провайдер)

## 8) Last Gate Result
- Result: pass
- Gate checked:
  - release readiness (strict)
  - runtime readiness (public + admin)
  - handoff metadata strict check
- What was checked:
  - `bash scripts/verify-all.sh`
  - `SMOKE_ADMIN_EMAIL=smoke-admin@vsezapchasti.ru SMOKE_ADMIN_PASSWORD=... bash scripts/runtime-audit-local.sh`
  - `bash scripts/ci-local.sh --mode main`
  - `RELEASE_REQUIRE_HANDOFF_METADATA=1 RELEASE_REQUIRE_ADMIN_SMOKE=1 SMOKE_ADMIN_BOOTSTRAP=1 SMOKE_ADMIN_EMAIL=smoke-admin@vsezapchasti.ru SMOKE_ADMIN_PASSWORD=... bash scripts/release-check.sh --skip-write-smoke`
- What passed:
  - verify-all green
  - runtime-audit-local green (включая admin endpoints)
  - pip-audit green
  - pnpm audit green
  - backup + restore-check green
  - smoke read/write green
  - strict metadata gate green
  - mandatory admin smoke green
- What failed or remains unverified:
  - none in automated release scope
- Evidence:
  - strict release-check (metadata + admin smoke): `✅ RELEASE CHECK GREEN` (2026-03-10 15:47–15:48)
  - runtime-audit-local (with admin credentials): `✅ all checks passed` (2026-03-10 15:42)
  - ci-local main: `✅ RELEASE CHECK GREEN` (2026-03-10 15:42–15:44)
  - latest backup artifact: `backups/postgres/release_20260310_154701.dump`
  - coverage: `70.70%`, tests: `86 passed`

## 9) Release / Operational Signals
- Prod-impacting flow: public leads/orders/service + admin management routes
- Primary health signal: `/health`, `/api/ready`, smoke read/write/admin checks
- Rollback trigger: failed smoke or failed post-deploy health checks
- Observation point: release-check + runtime-audit outputs
- Operational risk introduced by current change: low
- What contains this risk: backup/restore-check + reproducible verify gates

## 10) Manual Toil Check
- Recurring manual operational step introduced: no
