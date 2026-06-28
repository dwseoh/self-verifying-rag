"""Payment domain models — no external imports from web."""

from dataclasses import dataclass


@dataclass
class PaymentIntent:
    customer_id: str
    amount_cents: int
    currency: str = "USD"
