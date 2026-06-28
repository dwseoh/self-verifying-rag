"""Northstar web — cart operations."""

from apps.api.payments_gateway import create_payment_intent


def add_to_cart(customer_id: str, sku: str, amount_cents: int) -> dict:
    return {
        "customer_id": customer_id,
        "sku": sku,
        "amount_cents": amount_cents,
        "status": "in_cart",
    }


def checkout_cart(customer_id: str, total_cents: int) -> dict:
    return create_payment_intent(customer_id=customer_id, amount_cents=total_cents)
