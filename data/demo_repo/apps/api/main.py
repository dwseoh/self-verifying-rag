"""Northstar API gateway — FastAPI entry (demo stub)."""

from apps.api.payments_gateway import create_payment_intent


def route_checkout(customer_id: str, amount_cents: int) -> dict:
    return create_payment_intent(customer_id=customer_id, amount_cents=amount_cents)
