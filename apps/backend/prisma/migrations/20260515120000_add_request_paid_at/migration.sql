-- Track when an order has been paid for. Nullable: null = unpaid,
-- non-null = paid (timestamp is when the admin flipped it, or, in a
-- future Stripe integration, when a webhook fired).

ALTER TABLE "requests" ADD COLUMN "paid_at" TIMESTAMP(3);
