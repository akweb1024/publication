import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { SETTINGS_ROLES, isDefaultAdminEmail, prismaEnum } from "@pub/shared";
import type { CurrentUserType } from "../auth/current-user.decorator.js";
import { JournalResolverService } from "../journal-resolver/journal-resolver.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { EmailQueueService } from "../queues/queues.service.js";

const { MessageDeliveryStatus, NotificationEventStatus } = prismaEnum;

type TemplatePayload = {
  key: string;
  name: string;
  description?: string | null;
  subject: string;
  bodyHtml: string;
  variables: string[];
  active: boolean;
};

type SendTemplateEmailInput = {
  journalId: string;
  actorUserId: string;
  eventKey: string;
  templateKey: string;
  to: { email: string; userId?: string | null };
  variables: Record<string, string | number | boolean | null | undefined>;
  submissionId?: string | null;
  articleId?: string | null;
  threadSubject?: string;
};

const DEFAULT_TEMPLATES: TemplatePayload[] = [
  {
    key: "submission-confirmation",
    name: "Submission confirmation",
    description: "Sent to an author after a manuscript is submitted.",
    subject: "Submission received: {{trackingNumber}}",
    bodyHtml:
      "<p>Dear {{authorName}},</p><p>We have received your submission <strong>{{trackingNumber}}</strong> for {{journalTitle}}.</p><p>Title: {{manuscriptTitle}}</p>",
    variables: ["authorName", "trackingNumber", "journalTitle", "manuscriptTitle"],
    active: true,
  },
  {
    key: "reviewer-invite",
    name: "Reviewer invitation",
    description: "Sent when an editor invites a reviewer.",
    subject: "Review invitation: {{trackingNumber}}",
    bodyHtml:
      "<p>Dear {{reviewerName}},</p><p>You have been invited to review <strong>{{manuscriptTitle}}</strong>.</p><p>Please respond by {{respondBy}}.</p>",
    variables: ["reviewerName", "trackingNumber", "manuscriptTitle", "respondBy"],
    active: true,
  },
  {
    key: "decision-letter",
    name: "Decision letter",
    description: "Sent to the corresponding author when an editorial decision is recorded.",
    subject: "Decision for {{trackingNumber}}",
    bodyHtml: "{{letterToAuthor}}",
    variables: ["trackingNumber", "decisionType", "letterToAuthor"],
    active: true,
  },
  {
    key: "revision-request",
    name: "Revision request",
    description: "Sent when an author must submit a revised manuscript.",
    subject: "Revision requested: {{trackingNumber}}",
    bodyHtml:
      "<p>Dear {{authorName}},</p><p>A revision has been requested for <strong>{{trackingNumber}}</strong>.</p><p>{{revisionInstructions}}</p>",
    variables: ["authorName", "trackingNumber", "revisionInstructions"],
    active: true,
  },
  {
    key: "article-published",
    name: "Article published",
    description: "Sent when an accepted article is published online.",
    subject: "Article published: {{articleTitle}}",
    bodyHtml: "<p>Your article <strong>{{articleTitle}}</strong> has been published in {{journalTitle}}.</p><p>{{articleUrl}}</p>",
    variables: ["articleTitle", "journalTitle", "articleUrl"],
    active: true,
  },
];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTemplate(source: string, variables: Record<string, string | number | boolean | null | undefined>, htmlVariables = new Set<string>()) {
  return source.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    const asString = value === null || value === undefined ? "" : String(value);
    return htmlVariables.has(key) ? asString : escapeHtml(asString);
  });
}

function variablesFromJson(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function compactVariables(variables: Record<string, string | number | boolean | null | undefined>) {
  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [key, value === undefined ? null : value])
  ) as Record<string, string | number | boolean | null>;
}

@Injectable()
export class CommunicationsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JournalResolverService) private readonly journalResolver: JournalResolverService,
    @Inject(EmailQueueService) private readonly emailQueue: EmailQueueService
  ) {}

  private async assertCanManageJournal(user: Pick<CurrentUserType, "id" | "email">, journalId: string) {
    if (isDefaultAdminEmail(user.email)) return;
    const role = await this.prisma.journalRoleAssignment.findFirst({
      where: { journalId, userId: user.id, role: { in: SETTINGS_ROLES } },
      select: { id: true },
    });
    if (!role) throw new ForbiddenException("Insufficient role");
  }

  private async ensureDefaultTemplates(journalId: string) {
    const existing = await this.prisma.emailTemplate.findMany({
      where: { journalId },
      select: { key: true },
    });
    const existingKeys = new Set(existing.map((item) => item.key));
    const missing = DEFAULT_TEMPLATES.filter((template) => !existingKeys.has(template.key));
    if (missing.length === 0) return;
    await this.prisma.emailTemplate.createMany({
      data: missing.map((template) => ({
        journalId,
        key: template.key,
        name: template.name,
        description: template.description ?? null,
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        variablesJson: template.variables,
        active: template.active,
      })),
      skipDuplicates: true,
    });
  }

  private serializeTemplate(template: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    subject: string;
    bodyHtml: string;
    variablesJson: Prisma.JsonValue;
    active: boolean;
    updatedAt: Date;
  }) {
    return {
      ...template,
      variables: variablesFromJson(template.variablesJson),
      variablesJson: undefined,
    };
  }

  async listTemplates(journalSlug: string, user: CurrentUserType) {
    const journal = await this.journalResolver.resolveSlug(journalSlug);
    await this.assertCanManageJournal(user, journal.id);
    await this.ensureDefaultTemplates(journal.id);

    const items = await this.prisma.emailTemplate.findMany({
      where: { journalId: journal.id },
      orderBy: [{ active: "desc" }, { key: "asc" }],
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        subject: true,
        bodyHtml: true,
        variablesJson: true,
        active: true,
        updatedAt: true,
      },
    });
    return { items: items.map((item) => this.serializeTemplate(item)) };
  }

  async createTemplate(journalSlug: string, user: CurrentUserType, dto: TemplatePayload) {
    const journal = await this.journalResolver.resolveSlug(journalSlug);
    await this.assertCanManageJournal(user, journal.id);
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { journalId_key: { journalId: journal.id, key: dto.key } },
      select: { id: true },
    });
    if (existing) throw new BadRequestException("Template key already exists for this journal");

    const created = await this.prisma.emailTemplate.create({
      data: {
        journalId: journal.id,
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        variablesJson: dto.variables,
        active: dto.active,
        updatedByUserId: user.id,
      },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        subject: true,
        bodyHtml: true,
        variablesJson: true,
        active: true,
        updatedAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        journalId: journal.id,
        actorUserId: user.id,
        action: "email_template.create",
        entityType: "EmailTemplate",
        entityId: created.id,
        metadataJson: { key: created.key },
      },
    });

    return this.serializeTemplate(created);
  }

  async updateTemplate(templateId: string, user: CurrentUserType, dto: Partial<Omit<TemplatePayload, "key">>) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, journalId: true, key: true },
    });
    if (!template) throw new NotFoundException("Template not found");
    await this.assertCanManageJournal(user, template.journalId);

    const updated = await this.prisma.emailTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description ?? null } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.bodyHtml !== undefined ? { bodyHtml: dto.bodyHtml } : {}),
        ...(dto.variables !== undefined ? { variablesJson: dto.variables } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        updatedByUserId: user.id,
      },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        subject: true,
        bodyHtml: true,
        variablesJson: true,
        active: true,
        updatedAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        journalId: template.journalId,
        actorUserId: user.id,
        action: "email_template.update",
        entityType: "EmailTemplate",
        entityId: template.id,
        metadataJson: { key: template.key, fields: Object.keys(dto) },
      },
    });

    return this.serializeTemplate(updated);
  }

  async sendTemplateTest(templateId: string, user: CurrentUserType, input: { toEmail?: string; variables: Record<string, string> }) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        journalId: true,
        key: true,
        name: true,
        subject: true,
        bodyHtml: true,
        variablesJson: true,
        journal: { select: { title: true } },
      },
    });
    if (!template) throw new NotFoundException("Template not found");
    await this.assertCanManageJournal(user, template.journalId);

    const variables = Object.fromEntries(
      variablesFromJson(template.variablesJson).map((key) => [key, input.variables[key] ?? `[${key}]`])
    );
    variables.journalTitle = variables.journalTitle ?? template.journal.title;

    return this.sendTemplateEmail({
      journalId: template.journalId,
      actorUserId: user.id,
      eventKey: "template.test",
      templateKey: template.key,
      to: { email: input.toEmail ?? user.email, userId: input.toEmail ? null : user.id },
      variables,
      threadSubject: `Template test: ${template.name}`,
    });
  }

  async sendTemplateEmail(input: SendTemplateEmailInput) {
    await this.ensureDefaultTemplates(input.journalId);
    const payloadJson = compactVariables(input.variables);
    const template = await this.prisma.emailTemplate.findUnique({
      where: { journalId_key: { journalId: input.journalId, key: input.templateKey } },
      select: { key: true, subject: true, bodyHtml: true, active: true },
    });
    if (!template?.active) {
      const event = await this.prisma.notificationEvent.create({
        data: {
          journalId: input.journalId,
          submissionId: input.submissionId ?? null,
          articleId: input.articleId ?? null,
          recipientUserId: input.to.userId ?? null,
          recipientEmail: input.to.email,
          eventKey: input.eventKey,
          templateKey: input.templateKey,
          subject: input.threadSubject ?? input.eventKey,
          status: NotificationEventStatus.SKIPPED,
          errorMessage: "Template is inactive or missing",
          payloadJson,
        },
      });
      return { ok: false, skipped: true, eventId: event.id };
    }

    if (input.to.userId) {
      const preference = await this.prisma.notificationPreference.findUnique({
        where: {
          journalId_userId_eventKey: {
            journalId: input.journalId,
            userId: input.to.userId,
            eventKey: input.eventKey,
          },
        },
        select: { emailEnabled: true },
      });
      if (preference?.emailEnabled === false) {
        const event = await this.prisma.notificationEvent.create({
          data: {
            journalId: input.journalId,
            submissionId: input.submissionId ?? null,
            articleId: input.articleId ?? null,
            recipientUserId: input.to.userId,
            recipientEmail: input.to.email,
            eventKey: input.eventKey,
            templateKey: template.key,
            subject: renderTemplate(template.subject, input.variables),
            status: NotificationEventStatus.SKIPPED,
            errorMessage: "Recipient disabled email for this event",
            payloadJson,
          },
        });
        return { ok: false, skipped: true, eventId: event.id };
      }
    }

    const subject = renderTemplate(template.subject, input.variables);
    const bodyHtml = renderTemplate(template.bodyHtml, input.variables, new Set(["letterToAuthor"]));

    const thread = await this.prisma.messageThread.create({
      data: {
        journalId: input.journalId,
        submissionId: input.submissionId ?? null,
        subject: input.threadSubject ?? subject,
        createdByUserId: input.actorUserId,
        messages: {
          create: {
            fromUserId: input.actorUserId,
            toEmails: [input.to.email],
            subjectOverride: subject,
            bodyHtml,
            templateKey: template.key,
            deliveryStatus: MessageDeliveryStatus.QUEUED,
          },
        },
      },
      select: { id: true, messages: { select: { id: true }, take: 1 } },
    });
    const messageId = thread.messages[0]?.id;

    const event = await this.prisma.notificationEvent.create({
      data: {
        journalId: input.journalId,
        submissionId: input.submissionId ?? null,
        articleId: input.articleId ?? null,
        threadId: thread.id,
        messageId,
        recipientUserId: input.to.userId ?? null,
        recipientEmail: input.to.email,
        eventKey: input.eventKey,
        templateKey: template.key,
        subject,
        status: NotificationEventStatus.QUEUED,
        queuedAt: new Date(),
        payloadJson,
      },
    });

    await this.emailQueue.enqueueEmail({ to: [input.to.email], subject, html: bodyHtml });
    return { ok: true, threadId: thread.id, messageId, eventId: event.id };
  }

  async listCommunications(journalSlug: string, user: CurrentUserType, limit: number) {
    const journal = await this.journalResolver.resolveSlug(journalSlug);
    await this.assertCanManageJournal(user, journal.id);

    const [threads, events] = await Promise.all([
      this.prisma.messageThread.findMany({
        where: { journalId: journal.id },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          subject: true,
          createdAt: true,
          updatedAt: true,
          submission: { select: { id: true, trackingNumber: true, manuscriptTitle: true } },
          createdBy: { select: { id: true, email: true, name: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              id: true,
              createdAt: true,
              toEmails: true,
              subjectOverride: true,
              templateKey: true,
              deliveryStatus: true,
              bodyHtml: true,
            },
          },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.notificationEvent.findMany({
        where: { journalId: journal.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          eventKey: true,
          templateKey: true,
          recipientEmail: true,
          subject: true,
          status: true,
          createdAt: true,
          queuedAt: true,
          sentAt: true,
          failedAt: true,
          errorMessage: true,
        },
      }),
    ]);
    return { threads, events };
  }

  async sendThreadMessage(threadId: string, user: CurrentUserType, input: { toEmails: string[]; subjectOverride?: string; bodyHtml: string }) {
    const thread = await this.prisma.messageThread.findUnique({
      where: { id: threadId },
      select: { id: true, journalId: true, subject: true },
    });
    if (!thread) throw new NotFoundException("Communication thread not found");
    await this.assertCanManageJournal(user, thread.journalId);

    const subject = input.subjectOverride ?? thread.subject;
    const message = await this.prisma.message.create({
      data: {
        threadId: thread.id,
        fromUserId: user.id,
        toEmails: input.toEmails,
        subjectOverride: subject,
        bodyHtml: input.bodyHtml,
        deliveryStatus: MessageDeliveryStatus.QUEUED,
      },
      select: { id: true },
    });
    await this.prisma.messageThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });

    await this.prisma.notificationEvent.createMany({
      data: input.toEmails.map((email) => ({
        journalId: thread.journalId,
        threadId: thread.id,
        messageId: message.id,
        recipientEmail: email,
        eventKey: "manual.message",
        subject,
        status: NotificationEventStatus.QUEUED,
        queuedAt: new Date(),
        payloadJson: {},
      })),
    });

    await this.emailQueue.enqueueEmail({ to: input.toEmails, subject, html: input.bodyHtml });
    return { ok: true, messageId: message.id };
  }

  async listPreferences(user: CurrentUserType, journalSlug?: string) {
    const where: Prisma.NotificationPreferenceWhereInput = { userId: user.id };
    if (journalSlug) {
      const journal = await this.journalResolver.resolveSlug(journalSlug);
      where.journalId = journal.id;
    }
    const items = await this.prisma.notificationPreference.findMany({
      where,
      orderBy: [{ eventKey: "asc" }],
      select: {
        id: true,
        eventKey: true,
        emailEnabled: true,
        journal: { select: { id: true, slug: true, title: true } },
      },
    });
    return { items };
  }

  async updatePreference(user: CurrentUserType, input: { journalSlug: string; eventKey: string; emailEnabled: boolean }) {
    const journal = await this.journalResolver.resolveSlug(input.journalSlug);
    const hasRole = await this.prisma.journalRoleAssignment.findFirst({
      where: { journalId: journal.id, userId: user.id },
      select: { id: true },
    });
    if (!hasRole && !isDefaultAdminEmail(user.email)) throw new ForbiddenException("Journal access required");

    const preference = await this.prisma.notificationPreference.upsert({
      where: { journalId_userId_eventKey: { journalId: journal.id, userId: user.id, eventKey: input.eventKey } },
      update: { emailEnabled: input.emailEnabled },
      create: {
        journalId: journal.id,
        userId: user.id,
        eventKey: input.eventKey,
        emailEnabled: input.emailEnabled,
      },
      select: { id: true, eventKey: true, emailEnabled: true },
    });
    return preference;
  }
}
