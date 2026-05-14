import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductionService } from "../../modules/production/production.service.js";

vi.mock("@pub/shared", () => ({
  EDITORIAL_ROLES: ["JOURNAL_ADMIN", "EDITOR_IN_CHIEF", "MANAGING_EDITOR"],
  PRODUCTION_TRACK: ["PRODUCTION_EDITOR", "COPYEDITOR"],
  prismaEnum: {
    ArticleStatus: {
      IN_PRESS: "IN_PRESS",
    },
    ArticleProductionStatus: {
      NOT_STARTED: "NOT_STARTED",
      IN_PRODUCTION: "IN_PRODUCTION",
      AUTHOR_PROOF: "AUTHOR_PROOF",
      FINAL_QA: "FINAL_QA",
      READY_FOR_PUBLICATION: "READY_FOR_PUBLICATION",
    },
    ProductionTaskType: {
      COPYEDIT: "COPYEDIT",
      TYPESET: "TYPESET",
      AUTHOR_PROOF: "AUTHOR_PROOF",
      EDITOR_PROOF: "EDITOR_PROOF",
      DOI_METADATA: "DOI_METADATA",
      FINAL_QA: "FINAL_QA",
    },
    ProductionTaskStatus: {
      TODO: "TODO",
      IN_PROGRESS: "IN_PROGRESS",
      BLOCKED: "BLOCKED",
      DONE: "DONE",
      CANCELLED: "CANCELLED",
    },
    ProofRoundStatus: {
      DRAFT: "DRAFT",
      SENT_TO_AUTHOR: "SENT_TO_AUTHOR",
      AUTHOR_APPROVED: "AUTHOR_APPROVED",
      EDITOR_APPROVED: "EDITOR_APPROVED",
      CHANGES_REQUESTED: "CHANGES_REQUESTED",
    },
  },
}));

function createPrismaMock() {
  return {
    journalRoleAssignment: {
      findFirst: vi.fn(),
    },
    article: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    productionTask: {
      count: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    proofRound: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    proofAnnotation: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

describe("ProductionService", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: ProductionService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.journalRoleAssignment.findFirst.mockResolvedValue({ id: "role-1" });
    prisma.article.findUnique.mockResolvedValue({
      id: "article-1",
      journalId: "journal-1",
      title: "Accepted Article",
      status: "IN_PRESS",
      productionStatus: "NOT_STARTED",
      issueId: null,
      submission: { trackingNumber: "DEMO-1", manuscriptTitle: "Accepted Article", submitterUserId: "author-1" },
    });
    service = new ProductionService(prisma as any, { resolveSlug: vi.fn().mockResolvedValue({ id: "journal-1", slug: "demo" }) } as any);
  });

  it("starts a production pipeline with the default task set", async () => {
    prisma.productionTask.count.mockResolvedValue(0);
    prisma.productionTask.createMany.mockResolvedValue({ count: 6 });
    prisma.article.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    prisma.productionTask.findMany.mockResolvedValue([]);
    prisma.proofRound.findMany.mockResolvedValue([]);

    await service.startPipeline("article-1", "editor-1", {});

    expect(prisma.productionTask.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ type: "COPYEDIT", title: "Copyedit manuscript" }),
        expect.objectContaining({ type: "FINAL_QA", title: "Final publication QA" }),
      ]),
    });
    expect(prisma.article.update).toHaveBeenCalledWith({
      where: { id: "article-1" },
      data: { productionStatus: "IN_PRODUCTION" },
    });
  });

  it("marks the article ready when required tasks are done and the proof is editor-approved", async () => {
    prisma.proofRound.findUnique.mockResolvedValue({
      id: "proof-1",
      articleId: "article-1",
      journalId: "journal-1",
      article: { submission: { submitterUserId: "author-1" } },
    });
    prisma.proofRound.update.mockResolvedValue({ id: "proof-1", status: "EDITOR_APPROVED" });
    prisma.productionTask.findMany.mockResolvedValue([
      { type: "COPYEDIT", status: "DONE" },
      { type: "TYPESET", status: "DONE" },
      { type: "AUTHOR_PROOF", status: "DONE" },
      { type: "EDITOR_PROOF", status: "DONE" },
      { type: "DOI_METADATA", status: "DONE" },
      { type: "FINAL_QA", status: "DONE" },
    ]);
    prisma.proofRound.findFirst.mockResolvedValue({ status: "EDITOR_APPROVED" });
    prisma.article.update.mockResolvedValue({});

    await service.approveProofRound("proof-1", { id: "editor-1", email: "editor@example.com", name: "Editor" }, "editor");

    expect(prisma.article.update).toHaveBeenCalledWith({
      where: { id: "article-1" },
      data: { productionStatus: "READY_FOR_PUBLICATION" },
    });
  });
});
