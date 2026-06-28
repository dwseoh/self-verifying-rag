# Checkout support runbook

## RUNBOOK_CHECKOUT_001: Escalation

If checkout errors spike after a deploy:

1. Check for new direct imports from web → payments.
2. Verify gateway health.
3. Compare deploy diff against ARCH_ADR_004.

## RUNBOOK_CHECKOUT_002: Common mistake

Engineers sometimes import `packages.payments.client` in web for "quick fixes" — this is forbidden and caused INCIDENT_PM_2024_03.
