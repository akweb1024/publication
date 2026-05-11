-- CreateEnum
CREATE TYPE "JournalStatus" AS ENUM ('DRAFT', 'LIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReviewModel" AS ENUM ('DOUBLE_BLIND');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "JournalRole" AS ENUM ('JOURNAL_ADMIN', 'EDITOR_IN_CHIEF', 'MANAGING_EDITOR', 'SECTION_EDITOR', 'ASSOCIATE_EDITOR', 'COPYEDITOR', 'PRODUCTION_EDITOR', 'REVIEWER', 'AUTHOR_SUPPORT');

-- CreateEnum
CREATE TYPE "PolicyContext" AS ENUM ('SUBMISSION', 'REVIEW', 'GENERAL');

-- CreateEnum
CREATE TYPE "FileSetKind" AS ENUM ('SUBMISSION', 'REVIEW', 'PRODUCTION', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "StoredFileRole" AS ENUM ('MANUSCRIPT', 'SUPPLEMENT', 'FIGURE', 'RESPONSE_LETTER', 'OTHER');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'TRIAGE', 'EDITOR_ASSIGNED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'REVISED_SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EditorAssignmentRole" AS ENUM ('HANDLING_EDITOR', 'SECTION_EDITOR');

-- CreateEnum
CREATE TYPE "ReviewAssignmentStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'OVERDUE', 'SUBMITTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewRecommendation" AS ENUM ('ACCEPT', 'MINOR', 'MAJOR', 'REJECT');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('DESK_REJECT', 'REVISE_MAJOR', 'REVISE_MINOR', 'ACCEPT', 'REJECT');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('PLANNED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ArticleAccess" AS ENUM ('OPEN', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('IN_PRESS', 'PUBLISHED', 'RETRACTED', 'CORRECTED', 'EOC');

-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "Publisher" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "supportEmail" TEXT NOT NULL,

    CONSTRAINT "Publisher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journal" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publisherId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issnPrint" TEXT,
    "issnOnline" TEXT,
    "description" TEXT,
    "status" "JournalStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewModel" "ReviewModel" NOT NULL DEFAULT 'DOUBLE_BLIND',
    "submissionEmailFrom" TEXT,
    "brandingJson" JSONB NOT NULL DEFAULT '{}',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "requiredPolicyKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "orcidId" TEXT,
    "orcidAccessTokenRef" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalRoleAssignment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "JournalRole" NOT NULL,

    CONSTRAINT "JournalRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "journalId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyDocument" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "policyDocumentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "contentHtml" TEXT NOT NULL,
    "changeNote" TEXT,
    "publishedByUserId" TEXT NOT NULL,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyAcceptance" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "policyVersionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" "PolicyContext" NOT NULL,

    CONSTRAINT "PolicyAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionSequence" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SubmissionSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalId" TEXT NOT NULL,
    "submitterUserId" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "manuscriptTitle" TEXT,
    "abstractText" TEXT,
    "keywordsText" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "articleType" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManuscriptVersion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submissionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "coverLetter" TEXT,
    "authorStatementJson" JSONB NOT NULL DEFAULT '{}',
    "fileSetId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "ManuscriptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileSet" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalId" TEXT NOT NULL,
    "kind" "FileSetKind" NOT NULL,
    "storagePrefix" TEXT NOT NULL,
    "checksumManifestJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "FileSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fileSetId" TEXT NOT NULL,
    "role" "StoredFileRole" NOT NULL DEFAULT 'OTHER',
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionContributor" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "affiliation" TEXT,
    "isCorresponding" BOOLEAN NOT NULL DEFAULT false,
    "orcidId" TEXT,
    "creditRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isAnonymizedCopy" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SubmissionContributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorAssignment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "EditorAssignmentRole" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),

    CONSTRAINT "EditorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRound" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submissionId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAssignment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewRoundId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "status" "ReviewAssignmentStatus" NOT NULL DEFAULT 'INVITED',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondBy" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewAssignmentId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "recommendation" "ReviewRecommendation",
    "commentsToAuthor" TEXT,
    "commentsToEditor" TEXT,
    "attachmentsFileSetId" TEXT,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewRoundId" TEXT,
    "type" "DecisionType" NOT NULL,
    "letterToAuthor" TEXT NOT NULL,
    "internalNote" TEXT,
    "decidedByUserId" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageThread" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalId" TEXT NOT NULL,
    "submissionId" TEXT,
    "subject" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "threadId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bodyHtml" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveryStatus" "MessageDeliveryStatus" NOT NULL DEFAULT 'QUEUED',

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Volume" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,

    CONSTRAINT "Volume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalId" TEXT NOT NULL,
    "volumeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "publicationDate" TIMESTAMP(3),
    "status" "IssueStatus" NOT NULL DEFAULT 'PLANNED',

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "issueId" TEXT,
    "title" TEXT NOT NULL,
    "abstractText" TEXT,
    "keywordsText" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "doi" TEXT,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "articleNumber" TEXT,
    "access" "ArticleAccess" NOT NULL DEFAULT 'OPEN',
    "licenseKey" TEXT,
    "publishedAt" TIMESTAMP(3),
    "status" "ArticleStatus" NOT NULL DEFAULT 'IN_PRESS',

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedAsset" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "articleId" TEXT NOT NULL,
    "pdfFileId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Journal_publisherId_idx" ON "Journal"("publisherId");

-- CreateIndex
CREATE UNIQUE INDEX "Journal_publisherId_slug_key" ON "Journal"("publisherId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "JournalRoleAssignment_userId_idx" ON "JournalRoleAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalRoleAssignment_journalId_userId_role_key" ON "JournalRoleAssignment"("journalId", "userId", "role");

-- CreateIndex
CREATE INDEX "AuditLog_journalId_occurredAt_idx" ON "AuditLog"("journalId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_occurredAt_idx" ON "AuditLog"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "PolicyDocument_journalId_idx" ON "PolicyDocument"("journalId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyDocument_journalId_key_key" ON "PolicyDocument"("journalId", "key");

-- CreateIndex
CREATE INDEX "PolicyVersion_policyDocumentId_effectiveFrom_idx" ON "PolicyVersion"("policyDocumentId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyVersion_policyDocumentId_versionNumber_key" ON "PolicyVersion"("policyDocumentId", "versionNumber");

-- CreateIndex
CREATE INDEX "PolicyAcceptance_userId_acceptedAt_idx" ON "PolicyAcceptance"("userId", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyAcceptance_policyVersionId_userId_context_key" ON "PolicyAcceptance"("policyVersionId", "userId", "context");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionSequence_journalId_year_key" ON "SubmissionSequence"("journalId", "year");

-- CreateIndex
CREATE INDEX "Submission_journalId_status_idx" ON "Submission"("journalId", "status");

-- CreateIndex
CREATE INDEX "Submission_submitterUserId_createdAt_idx" ON "Submission"("submitterUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_journalId_trackingNumber_key" ON "Submission"("journalId", "trackingNumber");

-- CreateIndex
CREATE INDEX "ManuscriptVersion_submissionId_idx" ON "ManuscriptVersion"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "ManuscriptVersion_submissionId_versionNumber_key" ON "ManuscriptVersion"("submissionId", "versionNumber");

-- CreateIndex
CREATE INDEX "StoredFile_fileSetId_idx" ON "StoredFile"("fileSetId");

-- CreateIndex
CREATE INDEX "StoredFile_storageKey_idx" ON "StoredFile"("storageKey");

-- CreateIndex
CREATE INDEX "SubmissionContributor_submissionId_idx" ON "SubmissionContributor"("submissionId");

-- CreateIndex
CREATE INDEX "EditorAssignment_submissionId_assignedAt_idx" ON "EditorAssignment"("submissionId", "assignedAt");

-- CreateIndex
CREATE INDEX "EditorAssignment_userId_assignedAt_idx" ON "EditorAssignment"("userId", "assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRound_submissionId_roundNumber_key" ON "ReviewRound"("submissionId", "roundNumber");

-- CreateIndex
CREATE INDEX "ReviewAssignment_reviewerUserId_status_idx" ON "ReviewAssignment"("reviewerUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewAssignment_reviewRoundId_reviewerUserId_key" ON "ReviewAssignment"("reviewRoundId", "reviewerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_reviewAssignmentId_key" ON "Review"("reviewAssignmentId");

-- CreateIndex
CREATE INDEX "Decision_submissionId_decidedAt_idx" ON "Decision"("submissionId", "decidedAt");

-- CreateIndex
CREATE INDEX "MessageThread_journalId_createdAt_idx" ON "MessageThread"("journalId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageThread_submissionId_idx" ON "MessageThread"("submissionId");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "Volume_journalId_idx" ON "Volume"("journalId");

-- CreateIndex
CREATE UNIQUE INDEX "Volume_journalId_year_number_key" ON "Volume"("journalId", "year", "number");

-- CreateIndex
CREATE INDEX "Issue_journalId_status_idx" ON "Issue"("journalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_journalId_volumeId_number_key" ON "Issue"("journalId", "volumeId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Article_submissionId_key" ON "Article"("submissionId");

-- CreateIndex
CREATE INDEX "Article_journalId_status_idx" ON "Article"("journalId", "status");

-- CreateIndex
CREATE INDEX "Article_issueId_idx" ON "Article"("issueId");

-- CreateIndex
CREATE INDEX "PublishedAsset_articleId_publishedAt_idx" ON "PublishedAsset"("articleId", "publishedAt");

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalRoleAssignment" ADD CONSTRAINT "JournalRoleAssignment_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalRoleAssignment" ADD CONSTRAINT "JournalRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyDocument" ADD CONSTRAINT "PolicyDocument_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_policyDocumentId_fkey" FOREIGN KEY ("policyDocumentId") REFERENCES "PolicyDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAcceptance" ADD CONSTRAINT "PolicyAcceptance_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAcceptance" ADD CONSTRAINT "PolicyAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionSequence" ADD CONSTRAINT "SubmissionSequence_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_submitterUserId_fkey" FOREIGN KEY ("submitterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManuscriptVersion" ADD CONSTRAINT "ManuscriptVersion_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManuscriptVersion" ADD CONSTRAINT "ManuscriptVersion_fileSetId_fkey" FOREIGN KEY ("fileSetId") REFERENCES "FileSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileSet" ADD CONSTRAINT "FileSet_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_fileSetId_fkey" FOREIGN KEY ("fileSetId") REFERENCES "FileSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionContributor" ADD CONSTRAINT "SubmissionContributor_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorAssignment" ADD CONSTRAINT "EditorAssignment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorAssignment" ADD CONSTRAINT "EditorAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRound" ADD CONSTRAINT "ReviewRound_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_reviewRoundId_fkey" FOREIGN KEY ("reviewRoundId") REFERENCES "ReviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewAssignmentId_fkey" FOREIGN KEY ("reviewAssignmentId") REFERENCES "ReviewAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_attachmentsFileSetId_fkey" FOREIGN KEY ("attachmentsFileSetId") REFERENCES "FileSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Volume" ADD CONSTRAINT "Volume_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_volumeId_fkey" FOREIGN KEY ("volumeId") REFERENCES "Volume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedAsset" ADD CONSTRAINT "PublishedAsset_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedAsset" ADD CONSTRAINT "PublishedAsset_pdfFileId_fkey" FOREIGN KEY ("pdfFileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
