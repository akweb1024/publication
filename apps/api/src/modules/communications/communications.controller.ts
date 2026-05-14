import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser, type CurrentUserType } from "../auth/current-user.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import { CommunicationsService } from "./communications.service.js";

const TemplatePayloadDto = z.object({
  key: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9._-]+$/, "Template key must contain lowercase letters, numbers, dots, underscores, or hyphens"),
  name: z.string().min(2).max(160),
  description: z.string().max(500).optional().nullable(),
  subject: z.string().min(2).max(240),
  bodyHtml: z.string().min(3).max(50_000),
  variables: z.array(z.string().min(1).max(80)).max(50).default([]),
  active: z.boolean().default(true),
});

const UpdateTemplatePayloadDto = TemplatePayloadDto.partial().omit({ key: true });

const TestTemplateDto = z.object({
  toEmail: z.string().email().optional(),
  variables: z.record(z.string()).default({}),
});

const SendThreadMessageDto = z.object({
  toEmails: z.array(z.string().email()).min(1).max(25),
  subjectOverride: z.string().min(2).max(240).optional(),
  bodyHtml: z.string().min(3).max(50_000),
});

const PreferencePayloadDto = z.object({
  journalSlug: z.string().min(1),
  eventKey: z.string().min(2).max(80),
  emailEnabled: z.boolean(),
});

const LimitQueryDto = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

@Controller()
export class CommunicationsController {
  constructor(@Inject(CommunicationsService) private readonly communications: CommunicationsService) {}

  @UseGuards(SessionGuard)
  @Get("journals/:journalSlug/email-templates")
  async listTemplates(@Param("journalSlug") journalSlug: string, @CurrentUser() user: CurrentUserType) {
    return this.communications.listTemplates(journalSlug, user);
  }

  @UseGuards(SessionGuard)
  @Post("journals/:journalSlug/email-templates")
  async createTemplate(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = TemplatePayloadDto.parse(body);
    return this.communications.createTemplate(journalSlug, user, dto);
  }

  @UseGuards(SessionGuard)
  @Patch("email-templates/:templateId")
  async updateTemplate(@Param("templateId") templateId: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = UpdateTemplatePayloadDto.parse(body);
    return this.communications.updateTemplate(templateId, user, dto);
  }

  @UseGuards(SessionGuard)
  @Post("email-templates/:templateId/test")
  async testTemplate(@Param("templateId") templateId: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = TestTemplateDto.parse(body);
    return this.communications.sendTemplateTest(templateId, user, dto);
  }

  @UseGuards(SessionGuard)
  @Get("journals/:journalSlug/communications")
  async listCommunications(@Param("journalSlug") journalSlug: string, @CurrentUser() user: CurrentUserType, @Query("limit") limit?: string) {
    const query = LimitQueryDto.parse({ limit: limit ?? 50 });
    return this.communications.listCommunications(journalSlug, user, query.limit);
  }

  @UseGuards(SessionGuard)
  @Post("communications/:threadId/messages")
  async sendThreadMessage(@Param("threadId") threadId: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = SendThreadMessageDto.parse(body);
    return this.communications.sendThreadMessage(threadId, user, dto);
  }

  @UseGuards(SessionGuard)
  @Get("me/notification-preferences")
  async listPreferences(@CurrentUser() user: CurrentUserType, @Query("journalSlug") journalSlug?: string) {
    return this.communications.listPreferences(user, journalSlug);
  }

  @UseGuards(SessionGuard)
  @Patch("me/notification-preferences")
  async updatePreference(@Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = PreferencePayloadDto.parse(body);
    return this.communications.updatePreference(user, dto);
  }
}
