# Python conventions — Northstar Bank

## PYTHON_STYLE_001: Layer imports

- `apps/web` may import `apps/api` only.
- `apps/web` must **never** import `packages/payments` directly.
- `apps/api` may import `packages/payments`.

## PYTHON_STYLE_002: Logging PII

Never log raw `customer_id` or card data. Use hashed identifiers in log messages.

## PYTHON_STYLE_003: Error handling

Public handlers must catch payment errors and return user-safe messages — no stack traces to clients.
