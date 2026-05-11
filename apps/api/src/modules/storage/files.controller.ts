import { Controller, Get, Inject, NotFoundException, Param, Res, UnauthorizedException, Req, ForbiddenException } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { JournalRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { StorageService } from "./storage.service.js";

const RESTRICTED_PDF_ALLOWED_ROLES: JournalRole[] = [
  JournalRole.JOURNAL_ADMIN,
  JournalRole.EDITOR_IN_CHIEF,
  JournalRole.MANAGING_EDITOR,
  JournalRole.SECTION_EDITOR,
  JournalRole.ASSOCIATE_EDITOR,
  JournalRole.COPYEDITOR,
  JournalRole.PRODUCTION_EDITOR,
  JournalRole.AUTHOR_SUPPORT,
  JournalRole.SUBSCRIBER,
];

@Controller("files")
export class FilesController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService
  ) {}

  @Get(":fileId/download")
  async download(@Param("fileId") fileId: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const file = await this.prisma.storedFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        storageKey: true,
        publishedAssets: {
          select: {
            articleId: true,
            article: { select: { access: true, journalId: true } },
          },
        },
      },
    });
    if (!file || file.publishedAssets.length === 0) throw new NotFoundException("File not found");
    const articleAccess = file.publishedAssets[0]?.article?.access;
    if (articleAccess === "RESTRICTED") {
      const userId = (req as any).session?.get("userId");
      if (!userId || typeof userId !== "string") {
        throw new UnauthorizedException("Login required to download this PDF");
      }
      const journalId = file.publishedAssets[0]?.article?.journalId;
      const entitlements = await this.prisma.journalRoleAssignment.findMany({
        where: {
          userId,
          journalId,
          role: { in: RESTRICTED_PDF_ALLOWED_ROLES },
        },
        select: { id: true, role: true, subscriptionStartAt: true, subscriptionEndAt: true },
      });
      const now = new Date();
      const entitled = entitlements.some((assignment) => {
        if (assignment.role !== JournalRole.SUBSCRIBER) return true;
        if (assignment.subscriptionStartAt && assignment.subscriptionStartAt > now) return false;
        if (assignment.subscriptionEndAt && assignment.subscriptionEndAt < now) return false;
        return true;
      });
      if (!entitled) {
        throw new ForbiddenException("You are not entitled to download this restricted PDF");
      }
    }

    const url = await this.storage.presignGetObject(file.storageKey);
    reply.redirect(url);
  }
}
