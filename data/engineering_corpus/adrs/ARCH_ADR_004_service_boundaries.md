# Architecture Decision Record — Service Boundaries

## ARCH_ADR_004: Service Boundary Rules

The web application (`apps/web`) must not import from the `packages/payments` package directly.

All payment operations from the web tier must go through the API gateway service (`apps/api/payments_gateway`).

Rationale: direct coupling caused operational incidents and bypasses centralized auth, logging, and rate limits.

## ARCH_ADR_004.1: Allowed call graph

- `apps/web` → `apps/api` → `packages/payments` — allowed
- `apps/web` → `packages/payments` — **forbidden**
