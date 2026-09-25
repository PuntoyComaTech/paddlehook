// ---- Event type string union ----

export type PaddleEventType =
  // Subscription
  | "subscription.activated"
  | "subscription.canceled"
  | "subscription.created"
  | "subscription.imported"
  | "subscription.past_due"
  | "subscription.paused"
  | "subscription.resumed"
  | "subscription.trialing"
  | "subscription.updated"
  // Transaction
  | "transaction.billed"
  | "transaction.canceled"
  | "transaction.completed"
  | "transaction.created"
  | "transaction.paid"
  | "transaction.past_due"
  | "transaction.payment_failed"
  | "transaction.ready"
  | "transaction.updated"
  // Customer
  | "customer.created"
  | "customer.imported"
  | "customer.updated"
  // Address
  | "address.created"
  | "address.imported"
  | "address.updated"
  // Business
  | "business.created"
  | "business.imported"
  | "business.updated"
  // Product
  | "product.created"
  | "product.imported"
  | "product.updated"
  // Price
  | "price.created"
  | "price.imported"
  | "price.updated"
  // Discount
  | "discount.created"
  | "discount.imported"
  | "discount.updated"
  // Adjustment
  | "adjustment.created"
  | "adjustment.updated"
  // Payout
  | "payout.created"
  | "payout.paid"
  // Report
  | "report.created"
  | "report.updated"
  // Catch-all for future events
  | (string & {})

// ---- Base event ----

export interface PaddleEvent<
  TType extends string = string,
  TData = Record<string, unknown>,
> {
  event_id: string
  event_type: TType
  occurred_at: string
  notification_id: string
  data: TData
}

// ---- Shared types ----

export interface Money {
  amount: string
  currency_code: string
}

export interface TimePeriod {
  interval: "day" | "week" | "month" | "year"
  frequency: number
}

export interface BillingPeriod {
  starts_at: string
  ends_at: string
}

export interface CustomData {
  [key: string]: unknown
}

// ---- Subscription data ----

export interface ScheduledChange {
  action: "cancel" | "pause" | "resume"
  effective_at: string
  resume_at: string | null
}

export interface SubscriptionItemPrice {
  id: string
  product_id: string
  description: string
  unit_price: Money
  billing_cycle: TimePeriod | null
  custom_data: CustomData | null
}

export interface SubscriptionItemProduct {
  id: string
  name: string
  custom_data: CustomData | null
}

export interface SubscriptionItem {
  quantity: number
  status: "active" | "inactive" | "trialing"
  created_at: string
  updated_at: string
  price: SubscriptionItemPrice
  product: SubscriptionItemProduct
}

export interface SubscriptionDiscount {
  id: string
  starts_at: string
  ends_at: string | null
}

export interface SubscriptionData {
  id: string
  status: "active" | "canceled" | "past_due" | "paused" | "trialing"
  customer_id: string
  address_id: string
  business_id: string | null
  currency_code: string
  created_at: string
  updated_at: string
  started_at: string | null
  first_billed_at: string | null
  next_billed_at: string | null
  canceled_at: string | null
  paused_at: string | null
  collection_mode: "automatic" | "manual"
  current_billing_period: BillingPeriod | null
  items: SubscriptionItem[]
  discount: SubscriptionDiscount | null
  scheduled_change: ScheduledChange | null
  custom_data: CustomData | null
  import_meta: Record<string, unknown> | null
}

// ---- Transaction data ----

export interface TransactionTotals {
  subtotal: string
  tax: string
  total: string
  discount: string
  credit: string
  grand_total: string
  fee: string | null
  earnings: string | null
  currency_code: string
}

export interface TransactionLineItem {
  id: string
  price_id: string
  quantity: number
  totals: TransactionTotals
  product: { id: string; name: string } | null
}

export interface TaxRate {
  tax_rate: string
  totals: { subtotal: string; tax: string; total: string; discount: string }
}

export interface TransactionDetails {
  totals: TransactionTotals
  line_items: TransactionLineItem[]
  payout_totals: TransactionTotals | null
  tax_rates_used: TaxRate[]
}

export interface Payment {
  payment_method_id: string
  amount: string
  status:
    | "authorized"
    | "authorized_flagged"
    | "canceled"
    | "captured"
    | "error"
    | "action_required"
    | "pending_no_action_required"
    | "created"
    | "unknown"
    | "dropped"
  created_at: string
}

export interface TransactionItem {
  price_id: string
  quantity: number
  price: SubscriptionItemPrice
}

export type TransactionOrigin =
  | "api"
  | "subscription_charge"
  | "subscription_payment_method_change"
  | "subscription_recurring"
  | "subscription_update"
  | "web"

export interface TransactionData {
  id: string
  status: "draft" | "ready" | "billed" | "paid" | "completed" | "canceled" | "past_due"
  customer_id: string | null
  address_id: string | null
  business_id: string | null
  currency_code: string
  subscription_id: string | null
  invoice_id: string | null
  invoice_number: string | null
  origin: TransactionOrigin
  collection_mode: "automatic" | "manual"
  created_at: string
  updated_at: string
  billed_at: string | null
  details: TransactionDetails
  payments: Payment[]
  items: TransactionItem[]
  custom_data: CustomData | null
  checkout: { url: string | null } | null
}

// ---- Customer data ----

export interface CustomerData {
  id: string
  email: string
  name: string | null
  locale: string
  marketing_consent: boolean
  status: "active" | "archived"
  created_at: string
  updated_at: string
  custom_data: CustomData | null
  import_meta: Record<string, unknown> | null
}

// ---- Adjustment data ----

export type AdjustmentAction = "credit" | "refund" | "chargeback" | "credit_reverse" | "chargeback_reverse" | "chargeback_warning"

export interface AdjustmentItem {
  id: string
  item_id: string
  type: "full" | "partial" | "tax" | "proration"
  amount: string | null
  proration: { rate: string; billing_period: BillingPeriod } | null
  totals: { subtotal: string; tax: string; total: string }
}

export interface AdjustmentData {
  id: string
  action: AdjustmentAction
  transaction_id: string
  subscription_id: string | null
  customer_id: string
  reason: string
  credit_applied_to_balance: boolean
  currency_code: string
  status: "pending_approval" | "approved" | "rejected" | "reversed"
  items: AdjustmentItem[]
  totals: { subtotal: string; tax: string; total: string }
  payout_totals: { subtotal: string; tax: string; total: string } | null
  created_at: string
  updated_at: string
}

// ---- Discriminated union ----

export type PaddleWebhookEvent =
  // Subscription events (typed data)
  | PaddleEvent<"subscription.activated", SubscriptionData>
  | PaddleEvent<"subscription.canceled", SubscriptionData>
  | PaddleEvent<"subscription.created", SubscriptionData>
  | PaddleEvent<"subscription.imported", SubscriptionData>
  | PaddleEvent<"subscription.past_due", SubscriptionData>
  | PaddleEvent<"subscription.paused", SubscriptionData>
  | PaddleEvent<"subscription.resumed", SubscriptionData>
  | PaddleEvent<"subscription.trialing", SubscriptionData>
  | PaddleEvent<"subscription.updated", SubscriptionData>
  // Transaction events (typed data)
  | PaddleEvent<"transaction.billed", TransactionData>
  | PaddleEvent<"transaction.canceled", TransactionData>
  | PaddleEvent<"transaction.completed", TransactionData>
  | PaddleEvent<"transaction.created", TransactionData>
  | PaddleEvent<"transaction.paid", TransactionData>
  | PaddleEvent<"transaction.past_due", TransactionData>
  | PaddleEvent<"transaction.payment_failed", TransactionData>
  | PaddleEvent<"transaction.ready", TransactionData>
  | PaddleEvent<"transaction.updated", TransactionData>
  // Customer events (typed data)
  | PaddleEvent<"customer.created", CustomerData>
  | PaddleEvent<"customer.imported", CustomerData>
  | PaddleEvent<"customer.updated", CustomerData>
  // Adjustment events (typed data)
  | PaddleEvent<"adjustment.created", AdjustmentData>
  | PaddleEvent<"adjustment.updated", AdjustmentData>
  // Catch-all for other events
  | PaddleEvent<string, Record<string, unknown>>
