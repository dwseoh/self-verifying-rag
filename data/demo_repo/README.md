# Northstar Bank — Demo Monorepo

Fictional fintech services layout for TrustLoop verification demos.

```txt
apps/web/       → customer-facing handlers (must NOT call payments directly)
apps/api/       → API gateway
packages/payments/ → payment service SDK
```

## Run checkout (compliant)

```python
from apps.web.checkout import process_checkout
process_checkout("cust_1", 1999)
```

## Verify with TrustLoop

```bash
# from trustloop repo root
curl -X POST http://localhost:8000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"repo_path":"data/demo_repo","changed_paths":["apps/web/checkout.py"]}'
```
