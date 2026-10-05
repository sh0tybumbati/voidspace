-- AlterTable
ALTER TABLE "appeals" ADD COLUMN     "escalated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "community_votes" ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "payload" JSONB,
ADD COLUMN     "proposer_id" TEXT,
ADD COLUMN     "required_approval" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
ADD COLUMN     "required_turnout" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
ADD COLUMN     "subscribers_at_start" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "voting_starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "mod_elections" ADD COLUMN     "accepted_at" TIMESTAMP(3),
ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "justification" TEXT,
ADD COLUMN     "nominator_id" TEXT,
ADD COLUMN     "required_approval" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
ADD COLUMN     "subscribers_at_start" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "category" VARCHAR(30) NOT NULL DEFAULT 'other',
ADD COLUMN     "resolution" VARCHAR(30),
ADD COLUMN     "resolution_note" TEXT;

-- AlterTable
ALTER TABLE "spaces" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "is_private" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "community_ballots" (
    "id" TEXT NOT NULL,
    "vote_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "vote" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_ballots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "data" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'image',
    "storage_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime" VARCHAR(100) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "community_ballots_vote_id_user_id_key" ON "community_ballots"("vote_id", "user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_type_idx" ON "auth_tokens"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "uploads_storage_key_key" ON "uploads"("storage_key");

-- CreateIndex
CREATE INDEX "uploads_user_id_created_at_idx" ON "uploads"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "reports_space_id_status_idx" ON "reports"("space_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporter_id_target_id_target_type_key" ON "reports"("reporter_id", "target_id", "target_type");

-- AddForeignKey
ALTER TABLE "mod_elections" ADD CONSTRAINT "mod_elections_nominator_id_fkey" FOREIGN KEY ("nominator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_votes" ADD CONSTRAINT "community_votes_proposer_id_fkey" FOREIGN KEY ("proposer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_ballots" ADD CONSTRAINT "community_ballots_vote_id_fkey" FOREIGN KEY ("vote_id") REFERENCES "community_votes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_ballots" ADD CONSTRAINT "community_ballots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

