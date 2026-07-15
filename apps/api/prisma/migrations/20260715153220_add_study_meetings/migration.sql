-- CreateTable
CREATE TABLE "StudyMeeting" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyMeeting_groupId_startsAt_idx" ON "StudyMeeting"("groupId", "startsAt");

-- AddForeignKey
ALTER TABLE "StudyMeeting" ADD CONSTRAINT "StudyMeeting_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
