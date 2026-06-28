#ifndef PAYMENTS_GATEWAY_H
#define PAYMENTS_GATEWAY_H

int gateway_charge(const char *customer_id, int amount_cents);

#endif
