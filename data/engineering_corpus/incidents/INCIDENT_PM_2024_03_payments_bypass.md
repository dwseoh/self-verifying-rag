# Postmortem — Payments Boundary Bypass

## INCIDENT_PM_2024_03: Direct web-to-payments import outage

**Date:** 2024-03-14  
**Severity:** SEV-2

### Summary

A developer added `from packages.payments.client import charge_customer` in `apps/web/checkout.py`, bypassing the API gateway. Under load, payment retries duplicated charges for ~2% of checkout sessions.

### Anti-pattern (never again)

- Direct `apps/web` → `packages/payments` imports
- Calling `charge_customer` without gateway idempotency keys

### Required fix pattern

Route all web payment calls through `apps.api.payments_gateway.create_payment_intent`.
