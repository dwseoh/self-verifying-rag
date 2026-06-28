"""Payments service client — must not be imported directly from web layer."""


def charge_customer(customer_id: str, amount_cents: int) -> dict:
    return {"status": "ok", "customer_id": customer_id, "amount_cents": amount_cents}
