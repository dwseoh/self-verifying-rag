"""API gateway facade for payment operations."""

from packages.payments.client import charge_customer


def create_payment_intent(customer_id: str, amount_cents: int) -> dict:
    return charge_customer(customer_id=customer_id, amount_cents=amount_cents)
