-- CreateEnum
CREATE TYPE "KnowledgeBookStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentType" AS ENUM ('README', 'ORIENTACOES', 'DEMO', 'VISAO_GERAL', 'TEMA', 'CAPITULO', 'FAQ', 'PALAVRAS_CHAVE', 'OTHER');

-- CreateEnum
CREATE TYPE "KnowledgeEditorialStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'REVIEWED', 'APPROVED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "KnowledgeBook" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "KnowledgeBookStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "catalogKey" TEXT,
    "filePath" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "type" "KnowledgeDocumentType" NOT NULL,
    "tags" TEXT[],
    "sensitiveTopics" TEXT[],
    "teacherReviewRecommended" BOOLEAN NOT NULL DEFAULT false,
    "editorialStatus" "KnowledgeEditorialStatus" NOT NULL DEFAULT 'DRAFT',
    "editorialNotes" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBook_slug_key" ON "KnowledgeBook"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeBook_status_idx" ON "KnowledgeBook"("status");

-- CreateIndex
CREATE INDEX "KnowledgeBook_sortOrder_title_idx" ON "KnowledgeBook"("sortOrder", "title");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_catalogKey_key" ON "KnowledgeDocument"("catalogKey");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_filePath_key" ON "KnowledgeDocument"("filePath");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_bookId_idx" ON "KnowledgeDocument"("bookId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_type_idx" ON "KnowledgeDocument"("type");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_editorialStatus_idx" ON "KnowledgeDocument"("editorialStatus");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_teacherReviewRecommended_idx" ON "KnowledgeDocument"("teacherReviewRecommended");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_bookId_editorialStatus_idx" ON "KnowledgeDocument"("bookId", "editorialStatus");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_sortOrder_title_idx" ON "KnowledgeDocument"("sortOrder", "title");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_reviewedByUserId_idx" ON "KnowledgeDocument"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_approvedByUserId_idx" ON "KnowledgeDocument"("approvedByUserId");

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "KnowledgeBook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
