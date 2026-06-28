# Northstar Bank Engineering Conventions

## COMMIT_MSG: Pull request titles

Use conventional commits: `feat:`, `fix:`, `docs:`.

## COMMIT_STYLE: Python imports

- Web layer (`apps/web`) must not import from `packages/payments` directly.
- Use `apps.api.payments_gateway` for all payment operations.
