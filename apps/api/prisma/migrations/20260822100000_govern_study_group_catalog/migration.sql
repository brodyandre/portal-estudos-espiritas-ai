-- Evolve StudyGroup for governed production bootstrap.
-- KnowledgeBook rows are created by explicit cataloging, so this migration is structural only.
ALTER TABLE "StudyGroup" ALTER COLUMN "meetingDay" DROP NOT NULL;
ALTER TABLE "StudyGroup" ALTER COLUMN "meetingTime" DROP NOT NULL;
ALTER TABLE "StudyGroup" ALTER COLUMN "participantCount" DROP NOT NULL;
ALTER TABLE "StudyGroup" ALTER COLUMN "bookTitle" DROP NOT NULL;
ALTER TABLE "StudyGroup" ALTER COLUMN "meetUrl" DROP NOT NULL;
ALTER TABLE "StudyGroup" ALTER COLUMN "description" DROP NOT NULL;

ALTER TABLE "StudyGroup" ADD COLUMN "knowledgeBookId" TEXT;

CREATE INDEX "StudyGroup_knowledgeBookId_idx" ON "StudyGroup"("knowledgeBookId");

ALTER TABLE "StudyGroup" ADD CONSTRAINT "StudyGroup_knowledgeBookId_fkey" FOREIGN KEY ("knowledgeBookId") REFERENCES "KnowledgeBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
