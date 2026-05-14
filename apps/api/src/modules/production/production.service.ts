import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ProductionTaskStatus as ProductionTaskStatusType,
  ProductionTaskType as ProductionTaskTypeType,
  ProofRoundStatus as ProofRoundStatusType,
} from "@prisma/client";
import { EDITORIAL_ROLES, PRODUCTION_TRACK, prismaEnum } from "@pub/shared";
import type { CurrentUserType } from "../auth/current-user.decorator.js";
import { JournalResolverService } from "../journal-resolver/journal-resolver.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

const { ArticleProductionStatus, ArticleStatus, ProductionTaskStatus, ProductionTaskType, ProofRoundStatus } = prismaEnum;

const DEFAULT_TASKS: Array<{ type: ProductionTaskTypeType; title: string; offsetDays: number }> = [
  { type: ProductionTaskType.COPYEDIT, title: "Copyedit manuscript", offsetDays: 3 },
  { type: ProductionTaskType.TYPESET, title: "Typeset final layout", offsetDays: 5 },
  { type: ProductionTaskType.AUTHOR_PROOF, title: "Author proof review", offsetDays: 7 },
  { type: ProductionTaskType.EDITOR_PROOF, title: "Editor proof approval", offsetDays: 8 },
  { type: ProductionTaskType.DOI_METADATA, title: "Verify DOI and article metadata", offsetDays: 9 },
  { type: ProductionTaskType.FINAL_QA, title: "Final publication QA", offsetDays: 10 },
];

function addDays(base: Date, days: number) {
  const value = new Date(base);
  value.setDate(value.getDate() + days);
  return value;
}

function nextProductionStatus(tasks: Array<{ type: ProductionTaskTypeType; status: ProductionTaskStatusType }>, proofStatus?: ProofRoundStatusType | null) {
  const activeTasks = tasks.filter((task) => task.status !== ProductionTaskStatus.CANCELLED);
  const allRequiredDone = DEFAULT_TASKS.every((required) =>
    activeTasks.some((task) => task.type === required.type && task.status === ProductionTaskStatus.DONE)
  );
  if (allRequiredDone && proofStatus === ProofRoundStatus.EDITOR_APPROVED) return ArticleProductionStatus.READY_FOR_PUBLICATION;
  if (proofStatus === ProofRoundStatus.AUTHOR_APPROVED || activeTasks.some((task) => task.type === ProductionTaskType.FINAL_QA && task.status === ProductionTaskStatus.IN_PROGRESS)) {
    return ArticleProductionStatus.FINAL_QA;
  }
  if (proofStatus === ProofRoundStatus.SENT_TO_AUTHOR || activeTasks.some((task) => task.type === ProductionTaskType.AUTHOR_PROOF && task.status !== ProductionTaskStatus.DONE)) {
    return ArticleProductionStatus.AUTHOR_PROOF;
  }
  if (activeTasks.length > 0) return ArticleProductionStatus.IN_PRODUCTION;
  return ArticleProductionStatus.NOT_STARTED;
}

@Injectable()
export class ProductionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JournalResolverService) private readonly journalResolver: JournalResolverService
  ) {}

  private async ensureProductionUser(userId: string, journalId: string) {
    const ok = await this.prisma.journalRoleAssignment.findFirst({
      where: { userId, journalId, role: { in: [...EDITORIAL_ROLES, ...PRODUCTION_TRACK] } },
      select: { id: true },
    });
    if (!ok) throw new ForbiddenException("Production role required");
  }

  private async ensureArticle(articleId: string) {
    const article = await this.prisma.article.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        journalId: true,
        title: true,
        status: true,
        productionStatus: true,
        issueId: true,
        submission: { select: { trackingNumber: true, manuscriptTitle: true, submitterUserId: true } },
      },
    });
    if (!article) throw new NotFoundException("Article not found");
    return article;
  }

  private async refreshArticleProductionStatus(articleId: string) {
    const [tasks, latestProofRound] = await Promise.all([
      this.prisma.productionTask.findMany({
        where: { articleId },
        select: { type: true, status: true },
      }),
      this.prisma.proofRound.findFirst({
        where: { articleId },
        orderBy: { roundNumber: "desc" },
        select: { status: true },
      }),
    ]);
    const productionStatus = nextProductionStatus(tasks, latestProofRound?.status);
    await this.prisma.article.update({ where: { id: articleId }, data: { productionStatus } });
    return productionStatus;
  }

  async listProductionArticles(journalSlug: string, userId: string) {
    const journal = await this.journalResolver.resolveSlug(journalSlug);
    await this.ensureProductionUser(userId, journal.id);
    const items = await this.prisma.article.findMany({
      where: { journalId: journal.id, status: ArticleStatus.IN_PRESS },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        productionStatus: true,
        issueId: true,
        submission: { select: { trackingNumber: true, manuscriptTitle: true } },
        productionTasks: { select: { id: true, status: true, type: true } },
        proofRounds: { orderBy: { roundNumber: "desc" }, take: 1, select: { id: true, roundNumber: true, status: true } },
      },
    });
    return {
      items: items.map((article) => ({
        ...article,
        taskSummary: {
          total: article.productionTasks.length,
          done: article.productionTasks.filter((task) => task.status === ProductionTaskStatus.DONE).length,
          blocked: article.productionTasks.filter((task) => task.status === ProductionTaskStatus.BLOCKED).length,
        },
        latestProofRound: article.proofRounds[0] ?? null,
      })),
    };
  }

  async listTasks(journalSlug: string, userId: string, query: { status?: ProductionTaskStatusType; articleId?: string }) {
    const journal = await this.journalResolver.resolveSlug(journalSlug);
    await this.ensureProductionUser(userId, journal.id);
    const items = await this.prisma.productionTask.findMany({
      where: { journalId: journal.id, ...(query.status ? { status: query.status } : {}), ...(query.articleId ? { articleId: query.articleId } : {}) },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        articleId: true,
        type: true,
        status: true,
        title: true,
        notes: true,
        dueAt: true,
        startedAt: true,
        completedAt: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        completedBy: { select: { id: true, name: true, email: true } },
        article: { select: { title: true, productionStatus: true, submission: { select: { trackingNumber: true } } } },
      },
    });
    return { items };
  }

  async getArticleProduction(articleId: string, userId: string) {
    const article = await this.ensureArticle(articleId);
    await this.ensureProductionUser(userId, article.journalId);
    const [tasks, proofRounds] = await Promise.all([
      this.prisma.productionTask.findMany({
        where: { articleId },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          type: true,
          status: true,
          title: true,
          notes: true,
          assignedToUserId: true,
          dueAt: true,
          startedAt: true,
          completedAt: true,
          assignedTo: { select: { id: true, name: true, email: true } },
          completedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.proofRound.findMany({
        where: { articleId },
        orderBy: { roundNumber: "desc" },
        select: {
          id: true,
          roundNumber: true,
          status: true,
          proofFileId: true,
          authorApprovedAt: true,
          editorApprovedAt: true,
          notes: true,
          annotations: {
            orderBy: { createdAt: "desc" },
            select: { id: true, pageNumber: true, anchorText: true, commentText: true, resolvedAt: true, createdAt: true, createdBy: { select: { name: true, email: true } } },
          },
        },
      }),
    ]);
    return { article, tasks, proofRounds };
  }

  async startPipeline(articleId: string, actorUserId: string, input: { assigneeUserId?: string; dueAt?: Date }) {
    const article = await this.ensureArticle(articleId);
    await this.ensureProductionUser(actorUserId, article.journalId);
    if (article.status !== ArticleStatus.IN_PRESS) throw new BadRequestException("Only in-press articles can enter production");

    const existing = await this.prisma.productionTask.count({ where: { articleId } });
    if (existing > 0) throw new BadRequestException("Production pipeline already started");

    const baseDueAt = input.dueAt ?? new Date();
    await this.prisma.productionTask.createMany({
      data: DEFAULT_TASKS.map((task) => ({
        journalId: article.journalId,
        articleId,
        type: task.type,
        title: task.title,
        assignedToUserId: input.assigneeUserId ?? null,
        dueAt: addDays(baseDueAt, task.offsetDays),
      })),
    });
    await this.prisma.article.update({ where: { id: articleId }, data: { productionStatus: ArticleProductionStatus.IN_PRODUCTION } });
    await this.prisma.auditLog.create({
      data: {
        journalId: article.journalId,
        actorUserId,
        action: "production.pipeline_start",
        entityType: "Article",
        entityId: articleId,
        metadataJson: { tasksCreated: DEFAULT_TASKS.length },
      },
    });
    return this.getArticleProduction(articleId, actorUserId);
  }

  async createTask(articleId: string, actorUserId: string, input: { type: ProductionTaskTypeType; title: string; notes?: string | null; assignedToUserId?: string | null; dueAt?: Date | null }) {
    const article = await this.ensureArticle(articleId);
    await this.ensureProductionUser(actorUserId, article.journalId);
    const task = await this.prisma.productionTask.create({
      data: {
        journalId: article.journalId,
        articleId,
        type: input.type,
        title: input.title,
        notes: input.notes ?? null,
        assignedToUserId: input.assignedToUserId ?? null,
        dueAt: input.dueAt ?? null,
      },
    });
    await this.refreshArticleProductionStatus(articleId);
    return task;
  }

  async updateTask(taskId: string, actorUserId: string, input: { status?: ProductionTaskStatusType; title?: string; notes?: string | null; assignedToUserId?: string | null; dueAt?: Date | null }) {
    const existing = await this.prisma.productionTask.findUnique({
      where: { id: taskId },
      select: { id: true, articleId: true, journalId: true, status: true },
    });
    if (!existing) throw new NotFoundException("Production task not found");
    await this.ensureProductionUser(actorUserId, existing.journalId);

    const now = new Date();
    const data: Record<string, unknown> = {};
    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === ProductionTaskStatus.IN_PROGRESS && existing.status !== ProductionTaskStatus.IN_PROGRESS) data.startedAt = now;
      if (input.status === ProductionTaskStatus.DONE) {
        data.completedAt = now;
        data.completedByUserId = actorUserId;
      }
      if (input.status !== ProductionTaskStatus.DONE) {
        data.completedAt = null;
        data.completedByUserId = null;
      }
    }
    if (input.title !== undefined) data.title = input.title;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.assignedToUserId !== undefined) data.assignedToUserId = input.assignedToUserId;
    if (input.dueAt !== undefined) data.dueAt = input.dueAt;

    const task = await this.prisma.productionTask.update({ where: { id: taskId }, data });
    await this.refreshArticleProductionStatus(existing.articleId);
    return task;
  }

  async createProofRound(articleId: string, actorUserId: string, input: { proofFileId?: string | null; notes?: string | null }) {
    const article = await this.ensureArticle(articleId);
    await this.ensureProductionUser(actorUserId, article.journalId);
    const last = await this.prisma.proofRound.findFirst({ where: { articleId }, orderBy: { roundNumber: "desc" }, select: { roundNumber: true } });
    const proofRound = await this.prisma.proofRound.create({
      data: {
        journalId: article.journalId,
        articleId,
        roundNumber: (last?.roundNumber ?? 0) + 1,
        proofFileId: input.proofFileId ?? null,
        notes: input.notes ?? null,
      },
    });
    await this.prisma.article.update({ where: { id: articleId }, data: { productionStatus: ArticleProductionStatus.AUTHOR_PROOF } });
    return proofRound;
  }

  async updateProofRound(proofRoundId: string, actorUserId: string, input: { status?: ProofRoundStatusType; proofFileId?: string | null; notes?: string | null }) {
    const existing = await this.prisma.proofRound.findUnique({ where: { id: proofRoundId }, select: { id: true, articleId: true, journalId: true } });
    if (!existing) throw new NotFoundException("Proof round not found");
    await this.ensureProductionUser(actorUserId, existing.journalId);
    const proofRound = await this.prisma.proofRound.update({
      where: { id: proofRoundId },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.proofFileId !== undefined ? { proofFileId: input.proofFileId } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    await this.refreshArticleProductionStatus(existing.articleId);
    return proofRound;
  }

  async approveProofRound(proofRoundId: string, user: CurrentUserType, actor: "author" | "editor") {
    const existing = await this.prisma.proofRound.findUnique({
      where: { id: proofRoundId },
      select: { id: true, articleId: true, journalId: true, article: { select: { submission: { select: { submitterUserId: true } } } } },
    });
    if (!existing) throw new NotFoundException("Proof round not found");
    if (actor === "editor") {
      await this.ensureProductionUser(user.id, existing.journalId);
    } else if (existing.article.submission.submitterUserId !== user.id) {
      throw new ForbiddenException("Only the submitter can author-approve this proof");
    }
    const now = new Date();
    const proofRound = await this.prisma.proofRound.update({
      where: { id: proofRoundId },
      data: actor === "author"
        ? { status: ProofRoundStatus.AUTHOR_APPROVED, authorApprovedAt: now, authorApprovedByUserId: user.id }
        : { status: ProofRoundStatus.EDITOR_APPROVED, editorApprovedAt: now, editorApprovedByUserId: user.id },
    });
    await this.refreshArticleProductionStatus(existing.articleId);
    return proofRound;
  }

  async createAnnotation(proofRoundId: string, actorUserId: string, input: { pageNumber?: number | null; anchorText?: string | null; commentText: string }) {
    const proofRound = await this.prisma.proofRound.findUnique({
      where: { id: proofRoundId },
      select: { id: true, journalId: true },
    });
    if (!proofRound) throw new NotFoundException("Proof round not found");
    await this.ensureProductionUser(actorUserId, proofRound.journalId);
    return this.prisma.proofAnnotation.create({
      data: {
        proofRoundId,
        createdByUserId: actorUserId,
        pageNumber: input.pageNumber ?? null,
        anchorText: input.anchorText ?? null,
        commentText: input.commentText,
      },
    });
  }
}
