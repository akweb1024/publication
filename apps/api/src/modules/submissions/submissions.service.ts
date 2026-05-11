import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import * as prismaClient from "@prisma/client";
import type { JournalRole as JournalRoleType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import crypto from "node:crypto";
import { StorageService } from "../storage/storage.service.js";

const { JournalRole, SubmissionStatus } = prismaClient as {
  JournalRole: typeof import("@prisma/client").JournalRole;
  SubmissionStatus: typeof import("@prisma/client").SubmissionStatus;
};

function trackingCodeFromSlug(slug: string) {
  const code = slug.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return code.slice(0, 12) || "JOURNAL";
}

@Injectable()
export class SubmissionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService
  ) {}

  async createDraft(journalSlug: string, submitterUserId: string) {
    const journal = await this.prisma.journal.findFirst({ where: { slug: journalSlug }, select: { id: true, slug: true } });
    if (!journal) throw new NotFoundException("Journal not found");

    const fileSet = await this.prisma.fileSet.create({
      data: {
        journalId: journal.id,
        kind: "SUBMISSION",
        storagePrefix: `${journal.slug}/submissions/${crypto.randomUUID()}`,
      },
    });

    const submission = await this.prisma.submission.create({
      data: { journalId: journal.id, submitterUserId, status: SubmissionStatus.DRAFT },
    });

    await this.prisma.manuscriptVersion.create({
      data: { submissionId: submission.id, versionNumber: 1, fileSetId: fileSet.id },
    });

    return { id: submission.id };
  }

  async listMine(journalSlug: string, submitterUserId: string) {
    const journal = await this.prisma.journal.findFirst({ where: { slug: journalSlug }, select: { id: true } });
    if (!journal) throw new NotFoundException("Journal not found");
    const items = await this.prisma.submission.findMany({
      where: { journalId: journal.id, submitterUserId },
      select: { id: true, status: true, trackingNumber: true, manuscriptTitle: true, createdAt: true, submittedAt: true },
      orderBy: { createdAt: "desc" },
    });
    return { items };
  }

  async getForUser(submissionId: string, userId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        journal: { select: { id: true, slug: true, requiredPolicyKeys: true } },
        contributors: true,
        reviewRounds: { include: { assignments: { where: { reviewerUserId: userId } } } },
      },
    });
    if (!submission) throw new NotFoundException("Submission not found");

    const isSubmitter = submission.submitterUserId === userId;
    const editorRoles: JournalRoleType[] = [
      JournalRole.JOURNAL_ADMIN,
      JournalRole.EDITOR_IN_CHIEF,
      JournalRole.MANAGING_EDITOR,
      JournalRole.SECTION_EDITOR,
      JournalRole.ASSOCIATE_EDITOR,
    ];
    const hasEditorialRole = !!(await this.prisma.journalRoleAssignment.findFirst({
      where: { journalId: submission.journalId, userId, role: { in: editorRoles } },
      select: { id: true },
    }));

    const isReviewer = submission.reviewRounds.some((rr) => rr.assignments.length > 0);
    const canAccess = isSubmitter || hasEditorialRole || isReviewer;
    if (!canAccess) throw new ForbiddenException();

    const currentVersion = await this.prisma.manuscriptVersion.findFirst({
      where: { submissionId: submission.id, versionNumber: 1 },
      select: {
        fileSet: {
          select: {
            files: {
              select: { role: true },
            },
          },
        },
      },
    });

    const hasManuscriptFile = !!currentVersion?.fileSet.files.some((file) => file.role === "MANUSCRIPT");

    const base = {
      id: submission.id,
      journalSlug: submission.journal.slug,
      status: submission.status,
      trackingNumber: submission.trackingNumber,
      manuscriptTitle: submission.manuscriptTitle,
      abstractText: submission.abstractText,
      keywordsText: submission.keywordsText,
      articleType: submission.articleType,
      hasManuscriptFile,
      createdAt: submission.createdAt,
      submittedAt: submission.submittedAt,
    };

    if (hasEditorialRole || isSubmitter) {
      return { ...base, contributors: submission.contributors };
    }

    // Reviewer: redact identity fields for double-blind
    return { ...base, contributors: [] };
  }

  async submit(submissionId: string, userId: string, acceptedPolicyVersionIds: string[]) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { journal: { select: { id: true, slug: true, requiredPolicyKeys: true } } },
    });
    if (!submission) throw new NotFoundException("Submission not found");
    if (submission.submitterUserId !== userId) throw new ForbiddenException();
    if (submission.status !== SubmissionStatus.DRAFT) throw new BadRequestException("Only DRAFT can be submitted");

    const requiredKeys = submission.journal.requiredPolicyKeys;
    if (requiredKeys.length > 0) {
      const activePolicies = await this.prisma.policyVersion.findMany({
        where: {
          policyDocument: { journalId: submission.journalId, key: { in: requiredKeys } },
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        },
        select: { id: true, policyDocument: { select: { key: true } } },
      });

      const requiredVersionIds = new Set(activePolicies.map((p) => p.id));
      for (const id of acceptedPolicyVersionIds) requiredVersionIds.delete(id);
      if (requiredVersionIds.size > 0) throw new BadRequestException("Missing required policy acceptances");

      await this.prisma.policyAcceptance.createMany({
        data: acceptedPolicyVersionIds.map((policyVersionId) => ({
          policyVersionId,
          userId,
          context: "SUBMISSION",
        })),
        skipDuplicates: true,
      });
    }

    const now = new Date();
    const year = now.getUTCFullYear();
    const journal = await this.prisma.journal.findUnique({ where: { id: submission.journalId }, select: { slug: true } });
    if (!journal) throw new NotFoundException("Journal not found");

    const updated = await this.prisma.$transaction(async (tx) => {
      const seq = await tx.submissionSequence.upsert({
        where: { journalId_year: { journalId: submission.journalId, year } },
        update: {},
        create: { journalId: submission.journalId, year, nextNumber: 1 },
      });

      const nextNumber = seq.nextNumber;
      await tx.submissionSequence.update({
        where: { id: seq.id },
        data: { nextNumber: nextNumber + 1 },
      });

      const trackingNumber = `${trackingCodeFromSlug(journal.slug)}-${year}-${String(nextNumber).padStart(6, "0")}`;

      const submissionUpdated = await tx.submission.update({
        where: { id: submission.id },
        data: { status: SubmissionStatus.SUBMITTED, trackingNumber, submittedAt: now },
        select: { id: true, trackingNumber: true, status: true, submittedAt: true },
      });

      await tx.manuscriptVersion.updateMany({
        where: { submissionId: submission.id, versionNumber: 1 },
        data: { submittedAt: now },
      });

      return submissionUpdated;
    });

    return updated;
  }

  async createSubmissionUpload(
    submissionId: string,
    userId: string,
    input: { originalName: string; mimeType: string; sizeBytes: number; sha256: string; role: "MANUSCRIPT" | "SUPPLEMENT" | "FIGURE" | "RESPONSE_LETTER" | "OTHER" }
  ) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, journal: { select: { slug: true } }, journalId: true, submitterUserId: true, status: true },
    });
    if (!submission) throw new NotFoundException("Submission not found");
    if (submission.submitterUserId !== userId) throw new ForbiddenException();
    if (submission.status !== SubmissionStatus.DRAFT) throw new BadRequestException("Uploads only allowed in DRAFT");

    const version = await this.prisma.manuscriptVersion.findFirst({
      where: { submissionId, versionNumber: 1 },
      select: { fileSetId: true },
    });
    if (!version) throw new NotFoundException("Manuscript version not found");

    const ext = input.originalName.includes(".") ? input.originalName.split(".").pop() : "bin";
    const storageKey = `${submission.journal.slug}/submissions/${submission.id}/v1/${crypto.randomUUID()}.${ext}`;

    const storedFile = await this.prisma.storedFile.create({
      data: {
        fileSetId: version.fileSetId,
        role: input.role,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        sha256: input.sha256,
        storageKey,
        uploadedByUserId: userId,
      },
      select: { id: true, storageKey: true },
    });

    const uploadUrl = await this.storage.presignPutObject(storageKey, input.mimeType);
    return { fileId: storedFile.id, storageKey: storedFile.storageKey, uploadUrl };
  }

  async addContributor(
    submissionId: string,
    userId: string,
    input: { displayName: string; email: string; affiliation?: string; isCorresponding?: boolean; orcidId?: string; creditRoles?: string[]; isAnonymizedCopy?: boolean }
  ) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, submitterUserId: true, status: true },
    });
    if (!submission) throw new NotFoundException("Submission not found");
    if (submission.submitterUserId !== userId) throw new ForbiddenException();
    if (submission.status !== SubmissionStatus.DRAFT) throw new BadRequestException("Only DRAFT can be edited");

    return this.prisma.submissionContributor.create({
      data: {
        submissionId,
        displayName: input.displayName,
        email: input.email,
        affiliation: input.affiliation,
        isCorresponding: input.isCorresponding ?? false,
        orcidId: input.orcidId,
        creditRoles: input.creditRoles ?? [],
        isAnonymizedCopy: input.isAnonymizedCopy ?? false,
      },
      select: { id: true },
    });
  }

  async updateDraftMetadata(
    submissionId: string,
    userId: string,
    input: { manuscriptTitle?: string; abstractText?: string; keywordsText?: string[]; articleType?: string }
  ) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, submitterUserId: true, status: true },
    });
    if (!submission) throw new NotFoundException("Submission not found");
    if (submission.submitterUserId !== userId) throw new ForbiddenException();
    if (submission.status !== SubmissionStatus.DRAFT) throw new BadRequestException("Only DRAFT can be edited");

    return this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        manuscriptTitle: input.manuscriptTitle,
        abstractText: input.abstractText,
        keywordsText: input.keywordsText ?? [],
        articleType: input.articleType,
      },
      select: {
        id: true,
        manuscriptTitle: true,
        abstractText: true,
        keywordsText: true,
        articleType: true,
        status: true,
      },
    });
  }
}
