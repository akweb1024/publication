import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ReviewRecommendation as ReviewRecommendationType,
  ReviewAssignmentStatus as ReviewAssignmentStatusType,
} from "@prisma/client";
import { prismaEnum } from "@pub/shared";
import { PrismaService } from "../prisma/prisma.service.js";

const { ReviewRecommendation, ReviewAssignmentStatus } = prismaEnum;

@Injectable()
export class ReviewerService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) { }

  async listAssignments(userId: string) {
    const items = await this.prisma.reviewAssignment.findMany({
      where: { reviewerUserId: userId },
      select: {
        id: true,
        status: true,
        invitedAt: true,
        respondBy: true,
        dueAt: true,
        reviewRound: { select: { submissionId: true, roundNumber: true, submission: { select: { trackingNumber: true, manuscriptTitle: true } } } },
      },
      orderBy: { invitedAt: "desc" },
      take: 200,
    });
    return { items };
  }

  async respond(assignmentId: string, userId: string, response: "accept" | "decline") {
    const assignment = await this.prisma.reviewAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException("Assignment not found");
    if (assignment.reviewerUserId !== userId) throw new ForbiddenException();
    if (assignment.status !== ReviewAssignmentStatus.INVITED) throw new BadRequestException("Already responded");

    if (response === "accept") {
      await this.prisma.reviewAssignment.update({
        where: { id: assignmentId },
        data: { status: ReviewAssignmentStatus.ACCEPTED, acceptedAt: new Date() },
      });
    } else {
      await this.prisma.reviewAssignment.update({
        where: { id: assignmentId },
        data: { status: ReviewAssignmentStatus.DECLINED },
      });
    }
    return { ok: true };
  }

  async submitReview(
    assignmentId: string,
    userId: string,
    input: { recommendation: ReviewRecommendationType; commentsToAuthor: string; commentsToEditor?: string }
  ) {
    const assignment = await this.prisma.reviewAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException("Assignment not found");
    if (assignment.reviewerUserId !== userId) throw new ForbiddenException();
    const allowed: ReviewAssignmentStatusType[] = [ReviewAssignmentStatus.ACCEPTED, ReviewAssignmentStatus.OVERDUE];
    if (!allowed.includes(assignment.status)) {
      throw new BadRequestException("Assignment not accepted");
    }

    await this.prisma.review.update({
      where: { reviewAssignmentId: assignmentId },
      data: {
        submittedAt: new Date(),
        recommendation: input.recommendation,
        commentsToAuthor: input.commentsToAuthor,
        commentsToEditor: input.commentsToEditor,
      },
    });
    await this.prisma.reviewAssignment.update({ where: { id: assignmentId }, data: { status: ReviewAssignmentStatus.SUBMITTED } });
    return { ok: true };
  }
}
