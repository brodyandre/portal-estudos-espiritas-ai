-- AlterTable
ALTER TABLE "User"
ADD COLUMN "enrollmentId" TEXT,
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "temporaryPasswordGeneratedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_enrollmentId_key" ON "User"("enrollmentId");

-- AddForeignKey
ALTER TABLE "User"
ADD CONSTRAINT "User_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
