import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import * as prismaClient from "@prisma/client";
import { z } from "zod";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import { ReviewerService } from "./reviewer.service.js";

const { ReviewRecommendation } = prismaClient as {
  ReviewRecommendation: typeof import("@prisma/client").ReviewRecommendation;
};

const RespondDto = z.object({
  response: z.enum(["accept", "decline"]),
});

const SubmitReviewDto = z.object({
  recommendation: z.nativeEnum(ReviewRecommendation),
  commentsToAuthor: z.string().min(1),
  commentsToEditor: z.string().optional(),
});

@Controller("reviewer")
export class ReviewerController {
  constructor(@Inject(ReviewerService) private readonly reviewer: ReviewerService) {}

  @UseGuards(SessionGuard)
  @Get("assignments")
  async list(@CurrentUser() user: any) {
    return this.reviewer.listAssignments(user.id);
  }

  @UseGuards(SessionGuard)
  @Post("assignments/:assignmentId/respond")
  async respond(@Param("assignmentId") assignmentId: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = RespondDto.parse(body);
    return this.reviewer.respond(assignmentId, user.id, dto.response);
  }

  @UseGuards(SessionGuard)
  @Post("assignments/:assignmentId/submit-review")
  async submit(@Param("assignmentId") assignmentId: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = SubmitReviewDto.parse(body);
    return this.reviewer.submitReview(assignmentId, user.id, dto);
  }
}

@Controller()
export class ReviewerCompatController {
  constructor(@Inject(ReviewerService) private readonly reviewer: ReviewerService) {}

  @UseGuards(SessionGuard)
  @Post("review-assignments/:assignmentId/respond")
  async respondCompat(@Param("assignmentId") assignmentId: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = RespondDto.parse(body);
    return this.reviewer.respond(assignmentId, user.id, dto.response);
  }

  @UseGuards(SessionGuard)
  @Post("review-assignments/:assignmentId/submit-review")
  async submitCompat(@Param("assignmentId") assignmentId: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = SubmitReviewDto.parse(body);
    return this.reviewer.submitReview(assignmentId, user.id, dto);
  }
}
