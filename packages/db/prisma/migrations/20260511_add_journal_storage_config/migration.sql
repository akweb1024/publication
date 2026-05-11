-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('MINIO', 'S3', 'R2', 'GCS');

-- CreateEnum
CREATE TYPE "StorageTarget" AS ENUM ('LOCAL', 'EXTERNAL');

-- CreateTable
CREATE TABLE "JournalStorageConfig" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalId" TEXT NOT NULL,
    "localPathPrefix" TEXT NOT NULL DEFAULT 'system',
    "externalPathPrefixes" TEXT[] DEFAULT ARRAY['submissions','uploads','manuscripts','exports']::TEXT[],
    "defaultTarget" "StorageTarget" NOT NULL DEFAULT 'EXTERNAL',
    "externalProvider" "StorageProvider" NOT NULL DEFAULT 'MINIO',
    "externalEndpoint" TEXT,
    "externalRegion" TEXT,
    "externalBucket" TEXT,
    "externalForcePathStyle" BOOLEAN NOT NULL DEFAULT true,
    "encryptedSecretJson" TEXT,
    "secretVersion" INTEGER NOT NULL DEFAULT 1,
    "secretUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "JournalStorageConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalStorageConfig_journalId_key" ON "JournalStorageConfig"("journalId");

-- CreateIndex
CREATE INDEX "JournalStorageConfig_externalProvider_idx" ON "JournalStorageConfig"("externalProvider");

-- AddForeignKey
ALTER TABLE "JournalStorageConfig" ADD CONSTRAINT "JournalStorageConfig_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
