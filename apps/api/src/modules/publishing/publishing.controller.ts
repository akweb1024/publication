import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { ArticleStatus as ArticleStatusType } from "@prisma/client";
import { z } from "zod";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import { PublishingService } from "./publishing.service.js";

const CreateVolumeDto = z.object({ year: z.number().int().min(1900), number: z.number().int().min(1) });
const CreateIssueDto = z.object({
  volumeId: z.string().uuid(),
  number: z.number().int().min(1),
  title: z.string().optional(),
  publicationDate: z.string().datetime().optional(),
});
const AssignIssueDto = z.object({ issueId: z.string().uuid() });
const PublishDto = z.object({ pdfFileId: z.string().uuid() });

@Controller()
export class PublishingController {
  constructor(@Inject(PublishingService) private readonly publishing: PublishingService) {}

  @Get("journals/:journalSlug/volumes")
  async listVolumes(@Param("journalSlug") journalSlug: string) {
    return this.publishing.listVolumes(journalSlug);
  }

  @UseGuards(SessionGuard)
  @Post("journals/:journalSlug/volumes")
  async createVolume(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = CreateVolumeDto.parse(body);
    return this.publishing.createVolume(journalSlug, user.id, dto.year, dto.number);
  }

  @Get("journals/:journalSlug/issues")
  async listIssues(@Param("journalSlug") journalSlug: string) {
    return this.publishing.listIssues(journalSlug);
  }

  @UseGuards(SessionGuard)
  @Post("journals/:journalSlug/issues")
  async createIssue(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = CreateIssueDto.parse(body);
    return this.publishing.createIssue(journalSlug, user.id, {
      volumeId: dto.volumeId,
      number: dto.number,
      title: dto.title,
      publicationDate: dto.publicationDate ? new Date(dto.publicationDate) : undefined,
    });
  }

  @Get("journals/:journalSlug/issues/:issueId/articles")
  async listIssueArticles(@Param("journalSlug") journalSlug: string, @Param("issueId") issueId: string) {
    return this.publishing.listIssueArticles(journalSlug, issueId);
  }

  @Get("journals/:journalSlug/articles/:articleId")
  async getArticle(@Param("journalSlug") journalSlug: string, @Param("articleId") articleId: string) {
    return this.publishing.getArticle(journalSlug, articleId);
  }

  @Get("journals/:journalSlug/articles")
  async listArticles(@Param("journalSlug") journalSlug: string, @Query("status") status?: ArticleStatusType) {
    return this.publishing.listArticles(journalSlug, status);
  }

  @UseGuards(SessionGuard)
  @Post("articles/:articleId/assign-issue")
  async assignIssue(@Param("articleId") articleId: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = AssignIssueDto.parse(body);
    return this.publishing.assignIssue(articleId, user.id, dto.issueId);
  }

  @UseGuards(SessionGuard)
  @Post("articles/:articleId/publish")
  async publish(@Param("articleId") articleId: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = PublishDto.parse(body);
    return this.publishing.publishArticle(articleId, user.id, dto.pdfFileId);
  }

  @UseGuards(SessionGuard)
  @Post("articles/:articleId/doi/deposit")
  async queueDoiDeposit(@Param("articleId") articleId: string, @CurrentUser() user: any) {
    return this.publishing.enqueueDoiDeposit(articleId, user.id);
  }
}
