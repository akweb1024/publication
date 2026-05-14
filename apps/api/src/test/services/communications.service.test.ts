import { describe, expect, it, beforeEach, vi } from "vitest";
import { CommunicationsService } from "../../modules/communications/communications.service.js";

vi.mock("@pub/shared", () => ({
  SETTINGS_ROLES: ["JOURNAL_ADMIN", "EDITOR_IN_CHIEF", "MANAGING_EDITOR"],
  isDefaultAdminEmail: (email?: string | null) => email === "admin@example.com",
  prismaEnum: {
    MessageDeliveryStatus: {
      QUEUED: "QUEUED",
    },
    NotificationEventStatus: {
      PENDING: "PENDING",
      QUEUED: "QUEUED",
      SENT: "SENT",
      FAILED: "FAILED",
      SKIPPED: "SKIPPED",
    },
  },
}));

function createPrismaMock() {
  return {
    journalRoleAssignment: {
      findFirst: vi.fn(),
    },
    emailTemplate: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    messageThread: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
    notificationEvent: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    notificationPreference: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

describe("CommunicationsService", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let journalResolver: { resolveSlug: ReturnType<typeof vi.fn> };
  let emailQueue: { enqueueEmail: ReturnType<typeof vi.fn> };
  let service: CommunicationsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    journalResolver = { resolveSlug: vi.fn().mockResolvedValue({ id: "journal-1", slug: "demo-journal" }) };
    emailQueue = { enqueueEmail: vi.fn().mockResolvedValue(undefined) };
    prisma.journalRoleAssignment.findFirst.mockResolvedValue({ id: "role-1" });
    service = new CommunicationsService(prisma as any, journalResolver as any, emailQueue as any);
  });

  it("seeds default templates before listing templates", async () => {
    prisma.emailTemplate.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "tpl-1",
          key: "decision-letter",
          name: "Decision letter",
          description: null,
          subject: "Decision for {{trackingNumber}}",
          bodyHtml: "{{letterToAuthor}}",
          variablesJson: ["trackingNumber", "letterToAuthor"],
          active: true,
          updatedAt: new Date("2026-05-14T00:00:00.000Z"),
        },
      ]);

    const result = await service.listTemplates("demo-journal", {
      id: "admin-1",
      email: "admin@example.com",
      name: "Admin",
    });

    expect(prisma.emailTemplate.createMany).toHaveBeenCalled();
    expect(result.items[0]).toMatchObject({
      key: "decision-letter",
      variables: ["trackingNumber", "letterToAuthor"],
    });
  });

  it("renders a template, creates message history, records an event, and queues email", async () => {
    prisma.emailTemplate.findMany.mockResolvedValue([{ key: "decision-letter" }]);
    prisma.emailTemplate.findUnique.mockResolvedValue({
      key: "decision-letter",
      subject: "Decision for {{trackingNumber}}",
      bodyHtml: "{{letterToAuthor}}",
      active: true,
    });
    prisma.notificationPreference.findUnique.mockResolvedValue(null);
    prisma.messageThread.create.mockResolvedValue({
      id: "thread-1",
      messages: [{ id: "message-1" }],
    });
    prisma.notificationEvent.create.mockResolvedValue({ id: "event-1" });

    const result = await service.sendTemplateEmail({
      journalId: "journal-1",
      actorUserId: "editor-1",
      eventKey: "submission.decision",
      templateKey: "decision-letter",
      to: { email: "author@example.com", userId: "author-1" },
      submissionId: "submission-1",
      variables: {
        trackingNumber: "DEMO-2026-1",
        letterToAuthor: "<p>Accepted</p>",
      },
    });

    expect(result).toMatchObject({ ok: true, threadId: "thread-1", eventId: "event-1" });
    expect(prisma.messageThread.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        submissionId: "submission-1",
        messages: expect.objectContaining({
          create: expect.objectContaining({
            subjectOverride: "Decision for DEMO-2026-1",
            bodyHtml: "<p>Accepted</p>",
            deliveryStatus: "QUEUED",
          }),
        }),
      }),
    }));
    expect(prisma.notificationEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "QUEUED",
        recipientEmail: "author@example.com",
      }),
    }));
    expect(emailQueue.enqueueEmail).toHaveBeenCalledWith({
      to: ["author@example.com"],
      subject: "Decision for DEMO-2026-1",
      html: "<p>Accepted</p>",
    });
  });
});
