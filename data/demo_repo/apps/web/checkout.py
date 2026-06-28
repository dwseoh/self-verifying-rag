# Northstar Bank — Web checkout (clean MVP state)

from apps.api.payments_gateway import create_payment_intent


def process_checkout(customer_id: str, amount_cents: int) -> dict:
    """Process checkout via API gateway — compliant path."""
    return create_payment_intent(customer_id=customer_id, amount_cents=amount_cents)
