-- CreateEnum
CREATE TYPE "DataSyncRunStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "JournalDataSyncConfig" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "encryptedDatabaseUrl" TEXT,
    "hasValidatedConnection" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" "DataSyncRunStatus",
    "lastSyncMessage" TEXT,

    CONSTRAINT "JournalDataSyncConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalDataSyncRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "journalId" TEXT NOT NULL,
    "status" "DataSyncRunStatus" NOT NULL,
    "recordsSynced" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "JournalDataSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalDataSyncConfig_journalId_key" ON "JournalDataSyncConfig"("journalId");

-- CreateIndex
CREATE INDEX "JournalDataSyncRun_journalId_createdAt_idx" ON "JournalDataSyncRun"("journalId", "createdAt");

-- AddForeignKey
ALTER TABLE "JournalDataSyncConfig" ADD CONSTRAINT "JournalDataSyncConfig_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalDataSyncRun" ADD CONSTRAINT "JournalDataSyncRun_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
