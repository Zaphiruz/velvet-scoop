-- Add order_number to requests, backfilling existing rows in created_at order.
--
-- Done in three steps so we can backfill before NOT NULL is enforced and so
-- the sequence's last_value matches the highest assigned row (otherwise the
-- next nextval() would collide on the unique index).

-- 1. Add nullable column.
ALTER TABLE "requests" ADD COLUMN "order_number" INTEGER;

-- 2. Backfill in created_at order.
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at" ASC, "id" ASC) AS rn
  FROM "requests"
)
UPDATE "requests"
SET "order_number" = ordered.rn
FROM ordered
WHERE "requests"."id" = ordered."id";

-- 3. Promote to SERIAL: enforce NOT NULL, attach a sequence with the right
-- next value, and add the unique index.
CREATE SEQUENCE "requests_order_number_seq" OWNED BY "requests"."order_number";
SELECT setval(
  'requests_order_number_seq',
  GREATEST(COALESCE((SELECT MAX("order_number") FROM "requests"), 0), 1),
  -- false on an empty table so the first nextval returns 1 instead of 2.
  EXISTS (SELECT 1 FROM "requests")
);
ALTER TABLE "requests" ALTER COLUMN "order_number" SET DEFAULT nextval('requests_order_number_seq');
ALTER TABLE "requests" ALTER COLUMN "order_number" SET NOT NULL;
CREATE UNIQUE INDEX "requests_order_number_key" ON "requests"("order_number");
