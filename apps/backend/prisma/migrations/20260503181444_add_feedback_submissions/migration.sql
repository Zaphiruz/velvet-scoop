-- CreateTable
CREATE TABLE "feedback_submissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "issue_number" INTEGER NOT NULL,
    "issue_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT,
    "state_reason" TEXT,
    "closed_at" TIMESTAMP(3),
    "state_fetched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_submissions_user_id_created_at_idx" ON "feedback_submissions"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
