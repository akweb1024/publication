import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { SubmissionStatus } from "@prisma/client";
import { prismaEnum } from "@pub/shared";
import { z } from "zod";
import { CurrentUser, type CurrentUserType } from "../auth/current-user.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import { EditorService } from "./editor.service.js";

const { DecisionType, EditorAssignmentRole } = prismaEnum;

const AssignEditorDto = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(EditorAssignmentRole),
});

const InviteReviewerDto = z.object({
  reviewerUserId: z.string().uuid(),
  respondBy: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
});

const DecisionDto = z.object({
  type: z.nativeEnum(DecisionType),
  letterToAuthor: z.string().min(1),
  internalNote: z.string().optional(),
});

@Controller()
export class EditorController {
  constructor(@Inject(EditorService) private readonly editor: EditorService) { }

  @UseGuards(SessionGuard)
  @Get("journals/:journalSlug/editor/queue")
  async queue(
    @Param("journalSlug") journalSlug: string,
    @Query("status") status: SubmissionStatus | undefined,
    @CurrentUser() user: CurrentUserType
  ) {
    return this.editor.queue(journalSlug, user.id, status);
  }

  @UseGuards(SessionGuard)
  @Get("journals/:journalSlug/editor/candidates")
  async candidates(@Param("journalSlug") journalSlug: string, @CurrentUser() user: CurrentUserType) {
    return this.editor.candidates(journalSlug, user.id);
  }

  @UseGuards(SessionGuard)
  @Post("submissions/:submissionId/assign-editor")
  async assignEditor(@Param("submissionId") submissionId: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = AssignEditorDto.parse(body);
    return this.editor.assignEditor(submissionId, user.id, dto.userId, dto.role);
  }

  @UseGuards(SessionGuard)
  @Post("submissions/:submissionId/start-review-round")
  async startReviewRound(@Param("submissionId") submissionId: string, @CurrentUser() user: CurrentUserType) {
    return this.editor.startReviewRound(submissionId, user.id);
  }

  @UseGuards(SessionGuard)
  @Post("review-rounds/:reviewRoundId/invite-reviewer")
  async inviteReviewer(@Param("reviewRoundId") reviewRoundId: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = InviteReviewerDto.parse(body);
    return this.editor.inviteReviewer(
      reviewRoundId,
      user.id,
      dto.reviewerUserId,
      dto.respondBy ? new Date(dto.respondBy) : undefined,
      dto.dueAt ? new Date(dto.dueAt) : undefined
    );
  }

  @UseGuards(SessionGuard)
  @Post("review-assignments/:assignmentId/cancel")
  async cancel(@Param("assignmentId") assignmentId: string, @CurrentUser() user: CurrentUserType) {
    return this.editor.cancelReviewAssignment(assignmentId, user.id);
  }

  @UseGuards(SessionGuard)
  @Post("submissions/:submissionId/decisions")
  async decide(@Param("submissionId") submissionId: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = DecisionDto.parse(body);
    return this.editor.decide(submissionId, user.id, dto);
  }
}
