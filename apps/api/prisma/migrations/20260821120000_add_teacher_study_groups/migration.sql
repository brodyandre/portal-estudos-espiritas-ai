-- CreateTable
CREATE TABLE "TeacherStudyGroup" (
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherStudyGroup_pkey" PRIMARY KEY ("userId","groupId")
);

-- CreateIndex
CREATE INDEX "TeacherStudyGroup_groupId_idx" ON "TeacherStudyGroup"("groupId");

-- AddForeignKey
ALTER TABLE "TeacherStudyGroup" ADD CONSTRAINT "TeacherStudyGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherStudyGroup" ADD CONSTRAINT "TeacherStudyGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill legacy single-group teachers when the stored groupSlug matches a real StudyGroup.
INSERT INTO "TeacherStudyGroup" ("userId", "groupId", "createdAt")
SELECT "User"."id", "User"."groupSlug", CURRENT_TIMESTAMP
FROM "User"
INNER JOIN "StudyGroup" ON "StudyGroup"."id" = "User"."groupSlug"
WHERE "User"."role" = 'TEACHER'
  AND "User"."groupSlug" IS NOT NULL
ON CONFLICT ("userId", "groupId") DO NOTHING;
