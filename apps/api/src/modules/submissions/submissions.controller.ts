import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import { SubmissionsService } from "./submissions.service.js";

const SubmitDto = z.object({
  acceptedPolicyVersionIds: z.array(z.string().uuid()).default([]),
});

const CreateUploadDto = z.object({
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().min(32),
  role: z.enum(["MANUSCRIPT", "SUPPLEMENT", "FIGURE", "RESPONSE_LETTER", "OTHER"]).default("OTHER"),
});

const AddContributorDto = z.object({
  displayName: z.string().min(1),
  email: z.string().email(),
  affiliation: z.string().optional(),
  isCorresponding: z.boolean().optional(),
  orcidId: z.string().optional(),
  creditRoles: z.array(z.string()).optional(),
  isAnonymizedCopy: z.boolean().optional(),
});

const UpdateDraftDto = z.object({
  manuscriptTitle: z.string().min(1).optional(),
  abstractText: z.string().min(1).optional(),
  keywordsText: z.array(z.string()).optional(),
  articleType: z.string().min(1).optional(),
});

@Controller()
export class SubmissionsController {
  constructor(@Inject(SubmissionsService) private readonly submissions: SubmissionsService) {}

  @UseGuards(SessionGuard)
  @Post("journals/:journalSlug/submissions")
  async createDraft(@Param("journalSlug") journalSlug: string, @CurrentUser() user: any) {
    return this.submissions.createDraft(journalSlug, user.id);
  }

  @UseGuards(SessionGuard)
  @Get("submissions")
  async listMine(@Query("journalSlug") journalSlug: string, @Query("mine") mine: string, @CurrentUser() user: any) {
    if (mine !== "true") return { items: [] };
    return this.submissions.listMine(journalSlug, user.id);
  }

  @UseGuards(SessionGuard)
  @Get("submissions/:submissionId")
  async get(@Param("submissionId") submissionId: string, @CurrentUser() user: any) {
    return this.submissions.getForUser(submissionId, user.id);
  }

  @UseGuards(SessionGuard)
  @Post("submissions/:submissionId/submit")
  async submit(@Param("submissionId") submissionId: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = SubmitDto.parse(body);
    return this.submissions.submit(submissionId, user.id, dto.acceptedPolicyVersionIds);
  }

  @UseGuards(SessionGuard)
  @Post("submissions/:submissionId/files")
  async createUpload(
    @Param("submissionId") submissionId: string,
    @Body() body: unknown,
    @Query("debugStorage") debugStorage: string | undefined,
    @CurrentUser() user: any
  ) {
    const dto = CreateUploadDto.parse(body);
    return this.submissions.createSubmissionUpload(submissionId, user.id, dto, debugStorage === "true");
  }

  @UseGuards(SessionGuard)
  @Post("submissions/:submissionId/contributors")
  async addContributor(@Param("submissionId") submissionId: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = AddContributorDto.parse(body);
    return this.submissions.addContributor(submissionId, user.id, dto);
  }

  @UseGuards(SessionGuard)
  @Post("submissions/:submissionId/update-draft")
  async updateDraft(@Param("submissionId") submissionId: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = UpdateDraftDto.parse(body);
    return this.submissions.updateDraftMetadata(submissionId, user.id, dto);
  }
}
