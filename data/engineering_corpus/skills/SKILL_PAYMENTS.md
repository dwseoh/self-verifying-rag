# Skill: Payments integration reviews

## SKILL_PAYMENTS_001: Payments change checklist

When reviewing code that touches checkout or payments:

1. Confirm web layer does not import `packages/payments`.
2. Confirm gateway client is used (`apps.api.payments_gateway`).
3. Confirm no PII in logs (see PYTHON_STYLE_002).
4. Cross-check ARCH_ADR_004 and INCIDENT_PM_2024_03.

## SKILL_PAYMENTS_002: Required citations

Payment-related findings must cite at least one of:

- `ARCH_ADR_004`
- `INCIDENT_PM_2024_03`
- `DATA_POLICY_002`
