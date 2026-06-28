/* Compliant: API layer includes payments header */
#include "packages/payments/client.h"

int gateway_charge(const char *customer_id, int amount_cents) {
    return charge_customer(customer_id, amount_cents);
}
