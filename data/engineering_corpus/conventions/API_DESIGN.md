# API design conventions

## API_DESIGN_001: Gateway-only payment access

All payment operations from user-facing flows must go through `apps/api/payments_gateway`.

## API_DESIGN_002: Idempotency

Payment endpoints must accept idempotency keys for retry safety.
