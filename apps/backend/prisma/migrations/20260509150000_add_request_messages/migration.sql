-- New table for per-request chat threads. Standalone from the existing
-- `messages` table (which is sender↔recipient and currently unused in the UI).

CREATE TABLE "request_messages" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "request_messages_request_id_created_at_idx"
    ON "request_messages"("request_id", "created_at");

ALTER TABLE "request_messages"
    ADD CONSTRAINT "request_messages_request_id_fkey"
    FOREIGN KEY ("request_id") REFERENCES "requests"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "request_messages"
    ADD CONSTRAINT "request_messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
