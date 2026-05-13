import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { JournalResolverService } from "../journal-resolver/journal-resolver.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Controller("public")
export class PublicController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JournalResolverService) private readonly journalResolver: JournalResolverService
  ) { }

  @Get("journals")
  async listJournals() {
    const items = await this.prisma.journal.findMany({
      where: { status: "LIVE" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        issnPrint: true,
        issnOnline: true,
        reviewModel: true,
        timezone: true,
        requiredPolicyKeys: true,
      },
    });

    return { items };
  }

  @Get("journals/:journalSlug")
  async getJournal(@Param("journalSlug") journalSlug: string) {
    const journal = await this.journalResolver.resolveSlugWithStatus(journalSlug, "LIVE", {
      id: true,
      slug: true,
      title: true,
      description: true,
      issnPrint: true,
      issnOnline: true,
      reviewModel: true,
      timezone: true,
      requiredPolicyKeys: true,
      volumes: {
        orderBy: [{ year: "desc" }, { number: "desc" }],
        take: 5,
        select: { id: true, year: true, number: true },
      },
      issues: {
        where: { status: "PUBLISHED" },
        orderBy: [{ publicationDate: "desc" }, { createdAt: "desc" }],
        take: 10,
        select: { id: true, number: true, title: true, publicationDate: true, volumeId: true },
      },
    });

    return journal;
  }

  @Get("journals/:journalSlug/policies")
  async getJournalPolicies(@Param("journalSlug") journalSlug: string) {
    const journal = await this.journalResolver.resolveSlugWithStatus(journalSlug, "LIVE", { id: true, slug: true, title: true });

    const docs = await this.prisma.policyDocument.findMany({
      where: { journalId: journal.id },
      orderBy: { key: "asc" },
      select: {
        key: true,
        title: true,
        versions: {
          where: {
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
          },
          orderBy: [{ effectiveFrom: "desc" }, { versionNumber: "desc" }],
          take: 1,
          select: {
            versionNumber: true,
            effectiveFrom: true,
            effectiveTo: true,
            changeNote: true,
          },
        },
      },
    });

    return {
      journal: { slug: journal.slug, title: journal.title },
      items: docs.map((doc) => ({
        key: doc.key,
        title: doc.title,
        activeVersion: doc.versions[0] ?? null,
      })),
    };
  }

  @Get("articles/:articleId")
  async getArticle(@Param("articleId") articleId: string) {
    const article = await this.prisma.article.findFirst({
      where: {
        id: articleId,
        journal: { status: "LIVE" },
        status: { in: ["PUBLISHED", "IN_PRESS"] },
      },
      select: {
        id: true,
        title: true,
        abstractText: true,
        keywordsText: true,
        doi: true,
        pageStart: true,
        pageEnd: true,
        articleNumber: true,
        access: true,
        licenseKey: true,
        publishedAt: true,
        status: true,
        journal: {
          select: {
            id: true,
            slug: true,
            title: true,
            issnPrint: true,
            issnOnline: true,
            reviewModel: true,
          },
        },
        issue: {
          select: {
            id: true,
            number: true,
            title: true,
            publicationDate: true,
            volume: {
              select: {
                id: true,
                number: true,
                year: true,
              },
            },
          },
        },
        submission: {
          select: {
            contributors: {
              orderBy: [{ createdAt: "asc" }],
              select: {
                displayName: true,
                affiliation: true,
                orcidId: true,
                isCorresponding: true,
              },
            },
          },
        },
        publishedAssets: {
          orderBy: { publishedAt: "desc" },
          select: {
            id: true,
            pdfFileId: true,
            versionLabel: true,
            publishedAt: true,
          },
        },
      },
    });

    if (!article) throw new NotFoundException("Article not found");
    return article;
  }
}
