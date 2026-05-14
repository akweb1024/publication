import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { prismaEnum } from "@pub/shared";
import { z } from "zod";
import { CurrentUser, type CurrentUserType } from "../auth/current-user.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import { ProductionService } from "./production.service.js";

const { ProductionTaskStatus, ProductionTaskType, ProofRoundStatus } = prismaEnum;

const TaskListQueryDto = z.object({
  status: z.nativeEnum(ProductionTaskStatus).optional(),
  articleId: z.string().uuid().optional(),
});

const StartPipelineDto = z.object({
  assigneeUserId: z.string().uuid().optional(),
  dueAt: z.string().datetime().optional(),
});

const CreateTaskDto = z.object({
  type: z.nativeEnum(ProductionTaskType),
  title: z.string().min(2).max(200),
  notes: z.string().max(2000).optional().nullable(),
  assignedToUserId: z.string().uuid().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
});

const UpdateTaskDto = z.object({
  status: z.nativeEnum(ProductionTaskStatus).optional(),
  title: z.string().min(2).max(200).optional(),
  notes: z.string().max(2000).optional().nullable(),
  assignedToUserId: z.string().uuid().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
});

const CreateProofRoundDto = z.object({
  proofFileId: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const UpdateProofRoundDto = z.object({
  status: z.nativeEnum(ProofRoundStatus).optional(),
  proofFileId: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const ApproveProofDto = z.object({
  actor: z.enum(["author", "editor"]),
});

const CreateAnnotationDto = z.object({
  pageNumber: z.number().int().min(1).optional().nullable(),
  anchorText: z.string().max(300).optional().nullable(),
  commentText: z.string().min(2).max(3000),
});

function parseOptionalDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

@Controller()
export class ProductionController {
  constructor(@Inject(ProductionService) private readonly production: ProductionService) {}

  @UseGuards(SessionGuard)
  @Get("journals/:journalSlug/production/tasks")
  async listTasks(@Param("journalSlug") journalSlug: string, @Query() query: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = TaskListQueryDto.parse(query);
    return this.production.listTasks(journalSlug, user.id, dto);
  }

  @UseGuards(SessionGuard)
  @Get("journals/:journalSlug/production/articles")
  async listArticles(@Param("journalSlug") journalSlug: string, @CurrentUser() user: CurrentUserType) {
    return this.production.listProductionArticles(journalSlug, user.id);
  }

  @UseGuards(SessionGuard)
  @Get("articles/:articleId/production")
  async getArticleProduction(@Param("articleId") articleId: string, @CurrentUser() user: CurrentUserType) {
    return this.production.getArticleProduction(articleId, user.id);
  }

  @UseGuards(SessionGuard)
  @Post("articles/:articleId/production/start")
  async startPipeline(@Param("articleId") articleId: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = StartPipelineDto.parse(body ?? {});
    return this.production.startPipeline(articleId, user.id, {
      assigneeUserId: dto.assigneeUserId,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
    });
  }

  @UseGuards(SessionGuard)
  @Post("articles/:articleId/production/tasks")
  async createTask(@Param("articleId") articleId: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = CreateTaskDto.parse(body);
    return this.production.createTask(articleId, user.id, {
      type: dto.type,
      title: dto.title,
      notes: dto.notes,
      assignedToUserId: dto.assignedToUserId,
      dueAt: parseOptionalDate(dto.dueAt),
    });
  }

  @UseGuards(SessionGuard)
  @Patch("production/tasks/:taskId")
  async updateTask(@Param("taskId") taskId: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = UpdateTaskDto.parse(body);
    return this.production.updateTask(taskId, user.id, {
      status: dto.status,
      title: dto.title,
      notes: dto.notes,
      assignedToUserId: dto.assignedToUserId,
      dueAt: parseOptionalDate(dto.dueAt),
    });
  }

  @UseGuards(SessionGuard)
  @Post("articles/:articleId/proof-rounds")
  async createProofRound(@Param("articleId") articleId: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = CreateProofRoundDto.parse(body ?? {});
    return this.production.createProofRound(articleId, user.id, dto);
  }

  @UseGuards(SessionGuard)
  @Patch("proof-rounds/:proofRoundId")
  async updateProofRound(@Param("proofRoundId") proofRoundId: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = UpdateProofRoundDto.parse(body);
    return this.production.updateProofRound(proofRoundId, user.id, dto);
  }

  @UseGuards(SessionGuard)
  @Post("proof-rounds/:proofRoundId/approve")
  async approveProofRound(@Param("proofRoundId") proofRoundId: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = ApproveProofDto.parse(body);
    return this.production.approveProofRound(proofRoundId, user, dto.actor);
  }

  @UseGuards(SessionGuard)
  @Post("proof-rounds/:proofRoundId/annotations")
  async createAnnotation(@Param("proofRoundId") proofRoundId: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = CreateAnnotationDto.parse(body);
    return this.production.createAnnotation(proofRoundId, user.id, dto);
  }
}
