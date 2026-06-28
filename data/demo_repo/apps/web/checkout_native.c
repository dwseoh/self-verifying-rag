/* Demo: forbidden direct payments include from web layer (C boundary test) */
#include "apps/api/payments_gateway.h"

int web_checkout(const char *customer_id, int amount_cents) {
    return gateway_charge(customer_id, amount_cents);
}
