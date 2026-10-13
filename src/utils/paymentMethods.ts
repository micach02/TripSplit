import type { PaymentMethod } from '@/types/models'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  maya: 'Maya',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  paypal: 'PayPal',
  other: 'Other',
}

/** Most common first, for pickers. */
export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]

export function paymentMethodLabel(method: PaymentMethod | null | undefined): string {
  return method ? PAYMENT_METHOD_LABELS[method] : 'Not set'
}
