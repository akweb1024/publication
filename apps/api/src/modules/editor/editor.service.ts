import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  DecisionType as DecisionTypeType,
  EditorAssignmentRole as EditorAssignmentRoleType,
  SubmissionStatus as SubmissionStatusType,
} from "@prisma/client";
import { EDITOR_ROLES, prismaEnum } from "@pub/shared";
import { CommunicationsService } from "../communications/communications.service.js";
import { JournalResolverService } from "../journal-resolver/journal-resolver.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

const { DecisionType, EditorAssignmentRole, SubmissionStatus } = prismaEnum;

@Injectable()
export class EditorService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CommunicationsService) private readonly communications: CommunicationsService,
    @Inject(JournalResolverService) private readonly journalResolver: JournalResolverService
  ) { }

  private async ensureEditor(userId: string, journalId: string) {
    const ok = await this.prisma.journalRoleAssignment.findFirst({
      where: { userId, journalId, role: { in: EDITOR_ROLES } },
      select: { id: true },
    });
    if (!ok) throw new ForbiddenException();
  }

  async queue(journalSlug: string, userId: string, status?: SubmissionStatusType) {
    const journal = await this.journalResolver.resolveSlug(journalSlug);
    await this.ensureEditor(userId, journal.id);

    const items = await this.prisma.submission.findMany({
      where: { journalId: journal.id, ...(status ? { status } : {}) },
      select: {
        id: true,
        status: true,
        trackingNumber: true,
        manuscriptTitle: true,
        createdAt: true,
        submittedAt: true,
        reviewRounds: {
          orderBy: { roundNumber: "desc" },
          take: 1,
          select: {
            id: true,
            roundNumber: true,
            assignments: {
              select: { id: true, status: true, respondBy: true, dueAt: true },
            },
          },
        },
        editorAssignments: {
          where: { unassignedAt: null },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return {
      items: items.map((item) => {
        const assignments = item.reviewRounds[0]?.assignments ?? [];
        return {
          id: item.id,
          status: item.status,
          trackingNumber: item.trackingNumber,
          manuscriptTitle: item.manuscriptTitle,
          createdAt: item.createdAt,
          submittedAt: item.submittedAt,
          latestReviewRoundId: item.reviewRounds[0]?.id ?? null,
          latestReviewRoundNumber: item.reviewRounds[0]?.roundNumber ?? null,
          activeEditorAssignments: item.editorAssignments.length,
          reviewerInvitesCount: assignments.length,
          reviewerPendingCount: assignments.filter((assignment) => assignment.status === "INVITED").length,
          reviewerAcceptedCount: assignments.filter((assignment) => assignment.status === "ACCEPTED").length,
          nearestRespondBy:
            assignments
              .map((assignment) => assignment.respondBy)
              .filter((value): value is Date => !!value)
              .sort((left, right) => left.getTime() - right.getTime())[0] ?? null,
          nearestDueAt:
            assignments
              .map((assignment) => assignment.dueAt)
              .filter((value): value is Date => !!value)
              .sort((left, right) => left.getTime() - right.getTime())[0] ?? null,
        };
      }),
    };
  }

  async candidates(journalSlug: string, userId: string) {
    const journal = await this.journalResolver.resolveSlug(journalSlug);
    await this.ensureEditor(userId, journal.id);

    const assignments = await this.prisma.journalRoleAssignment.findMany({
      where: { journalId: journal.id, role: { in: [...EDITOR_ROLES, prismaEnum.JournalRole.REVIEWER] } },
      select: {
        role: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ role: "asc" }],
    });

    const editorMap = new Map<string, { id: string; name: string; email: string; roles: string[] }>();
    const reviewerMap = new Map<string, { id: string; name: string; email: string }>();

    for (const assignment of assignments) {
      if (assignment.role === prismaEnum.JournalRole.REVIEWER) {
        reviewerMap.set(assignment.user.id, {
          id: assignment.user.id,
          name: assignment.user.name,
          email: assignment.user.email,
        });
        continue;
      }
      const existing = editorMap.get(assignment.user.id);
      if (existing) {
        existing.roles.push(assignment.role);
      } else {
        editorMap.set(assignment.user.id, {
          id: assignment.user.id,
          name: assignment.user.name,
          email: assignment.user.email,
          roles: [assignment.role],
        });
      }
    }

    return {
      editors: Array.from(editorMap.values()),
      reviewers: Array.from(reviewerMap.values()),
    };
  }

  async assignEditor(submissionId: string, actorUserId: string, assigneeUserId: string, role: EditorAssignmentRoleType) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, journalId: true, status: true },
    });
    if (!submission) throw new NotFoundException("Submission not found");
    await this.ensureEditor(actorUserId, submission.journalId);

    await this.prisma.editorAssignment.create({ data: { submissionId, userId: assigneeUserId, role } });
    if (submission.status === SubmissionStatus.SUBMITTED || submission.status === SubmissionStatus.TRIAGE) {
      await this.prisma.submission.update({ where: { id: submissionId }, data: { status: SubmissionStatus.EDITOR_ASSIGNED } });
    }

    await this.prisma.auditLog.create({
      data: {
        journalId: submission.journalId,
        actorUserId,
        action: "submission.assign_editor",
        entityType: "Submission",
        entityId: submissionId,
        metadataJson: { assigneeUserId, role },
      },
    });

    return { ok: true };
  }

  async startReviewRound(submissionId: string, actorUserId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, journalId: true, status: true, reviewRounds: { select: { roundNumber: true } } },
    });
    if (!submission) throw new NotFoundException("Submission not found");
    await this.ensureEditor(actorUserId, submission.journalId);
    const allowed: SubmissionStatusType[] = [SubmissionStatus.EDITOR_ASSIGNED, SubmissionStatus.SUBMITTED, SubmissionStatus.TRIAGE];
    if (!allowed.includes(submission.status)) {
      throw new BadRequestException("Cannot start review round from current status");
    }

    const nextRound = (submission.reviewRounds.reduce((m, r) => Math.max(m, r.roundNumber), 0) ?? 0) + 1;
    const reviewRound = await this.prisma.reviewRound.create({
      data: { submissionId, roundNumber: nextRound },
      select: { id: true, roundNumber: true },
    });

    await this.prisma.submission.update({ where: { id: submissionId }, data: { status: SubmissionStatus.UNDER_REVIEW } });

    await this.prisma.auditLog.create({
      data: {
        journalId: submission.journalId,
        actorUserId,
        action: "review_round.start",
        entityType: "ReviewRound",
        entityId: reviewRound.id,
        metadataJson: { submissionId, roundNumber: reviewRound.roundNumber },
      },
    });

    return reviewRound;
  }

  async inviteReviewer(
    reviewRoundId: string,
    actorUserId: string,
    reviewerUserId: string,
    respondBy?: Date,
    dueAt?: Date
  ) {
    const rr = await this.prisma.reviewRound.findUnique({
      where: { id: reviewRoundId },
      select: { id: true, submission: { select: { id: true, journalId: true } } },
    });
    if (!rr) throw new NotFoundException("Review round not found");
    await this.ensureEditor(actorUserId, rr.submission.journalId);

    const assignment = await this.prisma.reviewAssignment.create({
      data: { reviewRoundId, reviewerUserId, respondBy, dueAt },
      select: { id: true },
    });
    await this.prisma.review.create({ data: { reviewAssignmentId: assignment.id } });

    await this.prisma.auditLog.create({
      data: {
        journalId: rr.submission.journalId,
        actorUserId,
        action: "reviewer.invite",
        entityType: "ReviewAssignment",
        entityId: assignment.id,
        metadataJson: { reviewRoundId, reviewerUserId, respondBy, dueAt },
      },
    });

    return { id: assignment.id };
  }

  async cancelReviewAssignment(assignmentId: string, actorUserId: string) {
    const assignment = await this.prisma.reviewAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, reviewRound: { select: { submission: { select: { journalId: true } } } } },
    });
    if (!assignment) throw new NotFoundException("Assignment not found");
    await this.ensureEditor(actorUserId, assignment.reviewRound.submission.journalId);

    await this.prisma.reviewAssignment.update({ where: { id: assignmentId }, data: { status: "CANCELLED" } });

    await this.prisma.auditLog.create({
      data: {
        journalId: assignment.reviewRound.submission.journalId,
        actorUserId,
        action: "review_assignment.cancel",
        entityType: "ReviewAssignment",
        entityId: assignmentId,
      },
    });

    return { ok: true };
  }

  async decide(
    submissionId: string,
    actorUserId: string,
    input: { type: DecisionTypeType; letterToAuthor: string; internalNote?: string }
  ) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        journalId: true,
        manuscriptTitle: true,
        submitter: { select: { id: true, email: true, name: true } },
        trackingNumber: true,
      },
    });
    if (!submission) throw new NotFoundException("Submission not found");
    await this.ensureEditor(actorUserId, submission.journalId);

    const now = new Date();
    await this.prisma.decision.create({
      data: {
        submissionId,
        type: input.type,
        letterToAuthor: input.letterToAuthor,
        internalNote: input.internalNote,
        decidedByUserId: actorUserId,
        decidedAt: now,
      },
    });

    const status =
      input.type === DecisionType.ACCEPT
        ? SubmissionStatus.ACCEPTED
        : input.type === DecisionType.REJECT || input.type === DecisionType.DESK_REJECT
          ? SubmissionStatus.REJECTED
          : SubmissionStatus.REVISION_REQUESTED;

    await this.prisma.submission.update({ where: { id: submissionId }, data: { status, decisionAt: now } });

    if (input.type === DecisionType.ACCEPT) {
      await this.prisma.article.upsert({
        where: { submissionId },
        update: {},
        create: {
          submissionId,
          journalId: submission.journalId,
          title: submission.trackingNumber ? `Accepted Article (${submission.trackingNumber})` : "Accepted Article",
          status: "IN_PRESS",
          access: "OPEN",
        },
      });
    }

    await this.communications.sendTemplateEmail({
      journalId: submission.journalId,
      actorUserId,
      eventKey: "submission.decision",
      templateKey: "decision-letter",
      to: { email: submission.submitter.email, userId: submission.submitter.id },
      submissionId,
      threadSubject: `Decision for ${submission.trackingNumber ?? submissionId}`,
      variables: {
        trackingNumber: submission.trackingNumber ?? "your submission",
        manuscriptTitle: submission.manuscriptTitle ?? "",
        decisionType: input.type,
        letterToAuthor: input.letterToAuthor,
        authorName: submission.submitter.name,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        journalId: submission.journalId,
        actorUserId,
        action: "submission.decision",
        entityType: "Submission",
        entityId: submissionId,
        metadataJson: { type: input.type },
      },
    });

    return { ok: true, status };
  }
}
