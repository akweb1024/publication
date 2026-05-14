-- CreateEnum
CREATE TYPE "ArticleProductionStatus" AS ENUM ('NOT_STARTED', 'IN_PRODUCTION', 'AUTHOR_PROOF', 'FINAL_QA', 'READY_FOR_PUBLICATION');

-- CreateEnum
CREATE TYPE "ProductionTaskType" AS ENUM ('COPYEDIT', 'TYPESET', 'AUTHOR_PROOF', 'EDITOR_PROOF', 'DOI_METADATA', 'FINAL_QA');

-- CreateEnum
CREATE TYPE "ProductionTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProofRoundStatus" AS ENUM ('DRAFT', 'SENT_TO_AUTHOR', 'AUTHOR_APPROVED', 'EDITOR_APPROVED', 'CHANGES_REQUESTED');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN "productionStatus" "ArticleProductionStatus" NOT NULL DEFAULT 'NOT_STARTED';

-- CreateTable
CREATE TABLE "ProductionTask" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "type" "ProductionTaskType" NOT NULL,
    "status" "ProductionTaskStatus" NOT NULL DEFAULT 'TODO',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "assignedToUserId" TEXT,
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ProductionTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofRound" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "ProofRoundStatus" NOT NULL DEFAULT 'DRAFT',
    "proofFileId" TEXT,
    "authorApprovedAt" TIMESTAMP(3),
    "authorApprovedByUserId" TEXT,
    "editorApprovedAt" TIMESTAMP(3),
    "editorApprovedByUserId" TEXT,
    "notes" TEXT,

    CONSTRAINT "ProofRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofAnnotation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "proofRoundId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "anchorText" TEXT,
    "commentText" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ProofAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Article_journalId_productionStatus_idx" ON "Article"("journalId", "productionStatus");

-- CreateIndex
CREATE INDEX "ProductionTask_journalId_status_idx" ON "ProductionTask"("journalId", "status");

-- CreateIndex
CREATE INDEX "ProductionTask_articleId_type_idx" ON "ProductionTask"("articleId", "type");

-- CreateIndex
CREATE INDEX "ProductionTask_assignedToUserId_status_idx" ON "ProductionTask"("assignedToUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProofRound_articleId_roundNumber_key" ON "ProofRound"("articleId", "roundNumber");

-- CreateIndex
CREATE INDEX "ProofRound_journalId_status_idx" ON "ProofRound"("journalId", "status");

-- CreateIndex
CREATE INDEX "ProofAnnotation_proofRoundId_createdAt_idx" ON "ProofAnnotation"("proofRoundId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofRound" ADD CONSTRAINT "ProofRound_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofRound" ADD CONSTRAINT "ProofRound_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofRound" ADD CONSTRAINT "ProofRound_proofFileId_fkey" FOREIGN KEY ("proofFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofRound" ADD CONSTRAINT "ProofRound_authorApprovedByUserId_fkey" FOREIGN KEY ("authorApprovedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofRound" ADD CONSTRAINT "ProofRound_editorApprovedByUserId_fkey" FOREIGN KEY ("editorApprovedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofAnnotation" ADD CONSTRAINT "ProofAnnotation_proofRoundId_fkey" FOREIGN KEY ("proofRoundId") REFERENCES "ProofRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofAnnotation" ADD CONSTRAINT "ProofAnnotation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
