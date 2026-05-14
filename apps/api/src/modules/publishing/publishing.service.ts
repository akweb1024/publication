import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ArticleStatus as ArticleStatusType, JournalRole as JournalRoleType } from "@prisma/client";
import { EDITOR_ROLES, prismaEnum } from "@pub/shared";
import { JournalResolverService } from "../journal-resolver/journal-resolver.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { EmailQueueService } from "../queues/queues.service.js";

const { ArticleProductionStatus, ArticleStatus } = prismaEnum;

@Injectable()
export class PublishingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailQueueService) private readonly emailQueue: EmailQueueService,
    @Inject(JournalResolverService) private readonly journalResolver: JournalResolverService
  ) { }

  private async ensureEditor(userId: string, journalId: string) {
    const ok = await this.prisma.journalRoleAssignment.findFirst({
      where: { userId, journalId, role: { in: EDITOR_ROLES } },
      select: { id: true },
    });
    if (!ok) throw new ForbiddenException();
  }

  async listVolumes(journalSlug: string) {
    const journal = await this.journalResolver.resolveSlug(journalSlug);
    const items = await this.prisma.volume.findMany({
      where: { journalId: journal.id },
      select: { id: true, year: true, number: true },
      orderBy: [{ year: "desc" }, { number: "desc" }],
    });
    return { items };
  }

  async createVolume(journalSlug: string, actorUserId: string, year: number, number: number) {
    const journal = await this.journalResolver.resolveSlug(journalSlug);
    await this.ensureEditor(actorUserId, journal.id);
    const existingForYear = await this.prisma.volume.findFirst({
      where: { journalId: journal.id, year },
      select: { id: true, number: true },
    });
    if (existingForYear) {
      throw new BadRequestException(
        `Volume already exists for ${year} in this journal. Only one volume per year is allowed.`
      );
    }
    return this.prisma.volume.create({ data: { journalId: journal.id, year, number }, select: { id: true, year: true, number: true } });
  }

  async listIssues(journalSlug: string) {
    const journal = await this.journalResolver.resolveSlug(journalSlug);
    const items = await this.prisma.issue.findMany({
      where: { journalId: journal.id },
      select: { id: true, volumeId: true, number: true, title: true, status: true, publicationDate: true },
      orderBy: [{ createdAt: "desc" }],
    });
    return { items };
  }

  async createIssue(
    journalSlug: string,
    actorUserId: string,
    input: { volumeId: string; number: number; title?: string; publicationDate?: Date }
  ) {
    const journal = await this.journalResolver.resolveSlug(journalSlug);
    await this.ensureEditor(actorUserId, journal.id);
    const volume = await this.prisma.volume.findFirst({ where: { id: input.volumeId, journalId: journal.id }, select: { id: true } });
    if (!volume) throw new BadRequestException("Invalid volumeId");

    return this.prisma.issue.create({
      data: { journalId: journal.id, volumeId: volume.id, number: input.number, title: input.title, publicationDate: input.publicationDate },
      select: { id: true, number: true, title: true, status: true, publicationDate: true, volumeId: true },
    });
  }

  async listIssueArticles(journalSlug: string, issueId: string) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, journal: { slug: journalSlug } },
      select: { id: true },
    });
    if (!issue) throw new NotFoundException("Issue not found");
    const items = await this.prisma.article.findMany({
      where: { issueId: issue.id },
      select: { id: true, title: true, doi: true, status: true, publishedAt: true, access: true },
      orderBy: { createdAt: "asc" },
    });
    return { items };
  }

  async getArticle(journalSlug: string, articleId: string) {
    const article = await this.prisma.article.findFirst({
      where: { id: articleId, journal: { slug: journalSlug }, status: { in: [ArticleStatus.IN_PRESS, ArticleStatus.PUBLISHED, ArticleStatus.CORRECTED, ArticleStatus.EOC, ArticleStatus.RETRACTED] } },
      select: {
        id: true,
        title: true,
        abstractText: true,
        keywordsText: true,
        doi: true,
        access: true,
        licenseKey: true,
        publishedAt: true,
        status: true,
        issue: { select: { id: true, number: true, title: true, publicationDate: true, volume: { select: { year: true, number: true } } } },
        publishedAssets: { select: { id: true, versionLabel: true, publishedAt: true, pdfFileId: true } },
      },
    });
    if (!article) throw new NotFoundException("Article not found");
    return article;
  }

  async listArticles(journalSlug: string, status?: ArticleStatusType) {
    const journal = await this.journalResolver.resolveSlug(journalSlug);
    const items = await this.prisma.article.findMany({
      where: { journalId: journal.id, ...(status ? { status } : {}) },
      select: {
        id: true,
        title: true,
        status: true,
        issueId: true,
        publishedAt: true,
        submission: { select: { trackingNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return { items };
  }

  async assignIssue(articleId: string, actorUserId: string, issueId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId }, select: { id: true, journalId: true } });
    if (!article) throw new NotFoundException("Article not found");
    await this.ensureEditor(actorUserId, article.journalId);
    const issue = await this.prisma.issue.findFirst({ where: { id: issueId, journalId: article.journalId }, select: { id: true } });
    if (!issue) throw new BadRequestException("Invalid issueId");
    await this.prisma.article.update({ where: { id: articleId }, data: { issueId: issue.id } });
    return { ok: true };
  }

  async publishArticle(articleId: string, actorUserId: string, pdfFileId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId }, select: { id: true, journalId: true, status: true, productionStatus: true } });
    if (!article) throw new NotFoundException("Article not found");
    await this.ensureEditor(actorUserId, article.journalId);
    if (article.status !== ArticleStatus.IN_PRESS) throw new BadRequestException("Only IN_PRESS can be published");
    if (
      article.productionStatus !== ArticleProductionStatus.NOT_STARTED &&
      article.productionStatus !== ArticleProductionStatus.READY_FOR_PUBLICATION
    ) {
      throw new BadRequestException("Article must complete production before publishing");
    }

    const now = new Date();
    await this.prisma.publishedAsset.create({
      data: { articleId: article.id, pdfFileId, versionLabel: "Version of Record", publishedAt: now },
    });
    await this.prisma.article.update({ where: { id: article.id }, data: { status: ArticleStatus.PUBLISHED, publishedAt: now } });
    return { ok: true };
  }

  async enqueueDoiDeposit(articleId: string, actorUserId: string) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      include: { journal: true },
    });
    if (!article) throw new NotFoundException("Article not found");
    await this.ensureEditor(actorUserId, article.journalId);

    await this.prisma.auditLog.create({
      data: {
        journalId: article.journalId,
        actorUserId,
        action: "article.doi_deposit_queued",
        entityType: "Article",
        entityId: articleId,
        metadataJson: { currentDoi: article.doi },
      },
    });

    // Placeholder async path for scale-up: route exists and queues a notification.
    await this.emailQueue.enqueueEmail({
      to: [article.journal.submissionEmailFrom ?? "support@publisher.local"],
      subject: `DOI deposit queued for article ${article.id}`,
      html: `<p>DOI deposit was queued for article <strong>${article.id}</strong>.</p>`,
    });

    return { ok: true, status: "queued" as const };
  }
}
