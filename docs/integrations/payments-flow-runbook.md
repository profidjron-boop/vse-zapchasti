# Payments Flow Runbook

## Scope
- Purpose: technical payment-flow contour for service prepayment.
- Runtime: feature-flags + webhook-driven status updates.
- Supported payment statuses: `pending`, `paid`, `failed`, `refunded`.

## Feature Flags (Admin -> Integrations)
- `feature_service_prepayment_enabled`:
  - Shows prepayment labels in public service catalog.
- `feature_service_payment_flow_enabled`:
  - Enables payment status fields and webhook processing.
- `feature_service_payment_block_unpaid_enabled`:
  - Blocks service request transition to `in_progress/closed` until `payment_status=paid`.
- `integration_payments_provider_name`:
  - Provider label stored in payment metadata.
- `integration_payments_default_currency`:
  - Default currency (for example `RUB`).

## Environment Secrets
- `PAYMENTS_WEBHOOK_TOKEN`:
  - Optional shared secret for `/api/public/payments/webhook`.
  - If configured, webhook must provide token in:
    - header `x-payments-token`, or
    - `Authorization: Bearer <token>`.

## Public Webhook API
- Endpoint: `POST /api/public/payments/webhook`
- Request body:
  - `entity_type`: `service_request` or `order`
  - `entity_id`: numeric entity id
  - `status`: `pending|paid|failed|refunded`
  - `payment_reference`: optional provider payment id
  - `provider`: optional provider code/name
  - `amount`: optional amount
  - `currency`: optional currency (default `RUB`)
  - `event`: optional raw provider event name
  - `error`: optional error text for failed status
- Result:
  - updates payment fields on target entity,
  - writes audit record,
  - emits internal notification event `payment.status_changed`.

## Admin Health API
- Endpoint: `GET /api/admin/integrations/payments/health`
- Returns:
  - current feature flags,
  - provider/currency values,
  - webhook endpoint path,
  - token configured flag.

## Business Rule
- If both flags are on:
  - `feature_service_payment_flow_enabled=1`
  - `feature_service_payment_block_unpaid_enabled=1`
- then service request cannot move to `in_progress` or `closed` until payment status is `paid`.

## Smoke Checklist
1. Enable payment-flow flags in admin integrations page.
2. Set provider name and default currency.
3. Configure `PAYMENTS_WEBHOOK_TOKEN` in environment.
4. Create service request for a service with required prepayment.
5. Confirm request starts with `payment_status=pending`.
6. Send webhook with status `paid` and verify payment fields/audit.
7. Verify status transition to `in_progress` works only after `paid`.
