-- CreateEnum
CREATE TYPE "InvitationType" AS ENUM ('ENROLLMENT_APPROVAL', 'ADMIN_REINVITE');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'NOT_CONFIGURED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "accountActivatedAt" TIMESTAMP(3);

UPDATE "User"
SET "accountActivatedAt" = CURRENT_TIMESTAMP
WHERE "accountActivatedAt" IS NULL;

-- CreateTable
CREATE TABLE "AccountInvitation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "invitedByUserId" TEXT,
    "invitationType" "InvitationType" NOT NULL,
    "recipientEmailSnapshot" TEXT NOT NULL,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "deliveredAt" TIMESTAMP(3),
    "deliveryFailedAt" TIMESTAMP(3),

    CONSTRAINT "AccountInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountInvitation_tokenHash_key" ON "AccountInvitation"("tokenHash");
CREATE INDEX "AccountInvitation_userId_idx" ON "AccountInvitation"("userId");
CREATE INDEX "AccountInvitation_expiresAt_idx" ON "AccountInvitation"("expiresAt");
CREATE INDEX "AccountInvitation_acceptedAt_idx" ON "AccountInvitation"("acceptedAt");
CREATE INDEX "AccountInvitation_invalidatedAt_idx" ON "AccountInvitation"("invalidatedAt");
CREATE INDEX "AccountInvitation_deliveryStatus_idx" ON "AccountInvitation"("deliveryStatus");
CREATE INDEX "AccountInvitation_invitedByUserId_idx" ON "AccountInvitation"("invitedByUserId");
CREATE INDEX "AccountInvitation_userId_invitationType_acceptedAt_invalidatedAt_idx" ON "AccountInvitation"("userId", "invitationType", "acceptedAt", "invalidatedAt");

-- AddForeignKey
ALTER TABLE "AccountInvitation"
ADD CONSTRAINT "AccountInvitation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountInvitation"
ADD CONSTRAINT "AccountInvitation_invitedByUserId_fkey"
FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
