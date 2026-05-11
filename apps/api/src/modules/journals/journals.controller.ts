import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JournalRole } from "@prisma/client";
import { z } from "zod";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import { PrismaService } from "../prisma/prisma.service.js";

const UpdateJournalDto = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  issnPrint: z.string().nullable().optional(),
  issnOnline: z.string().nullable().optional(),
  timezone: z.string().min(1).optional(),
  brandingJson: z.record(z.any()).optional(),
  requiredPolicyKeys: z.array(z.string().min(1)).optional(),
});

const SETTINGS_ROLES: JournalRole[] = [
  JournalRole.JOURNAL_ADMIN,
  JournalRole.EDITOR_IN_CHIEF,
  JournalRole.MANAGING_EDITOR,
];
const AuditListQueryDto = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
const AssignRoleDto = z.object({
  email: z.string().email(),
  role: z.nativeEnum(JournalRole),
  subscriptionStartAt: z.string().datetime().optional(),
  subscriptionEndAt: z.string().datetime().optional(),
});

@Controller("journals")
export class JournalsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const journals = await this.prisma.journal.findMany({
      where: { status: "LIVE" },
      select: { id: true, slug: true, title: true, description: true, timezone: true },
      orderBy: { createdAt: "asc" },
    });
    return { items: journals };
  }

  @Get(":journalSlug")
  async get(@Param("journalSlug") journalSlug: string) {
    const journal = await this.prisma.journal.findFirst({
      where: { slug: journalSlug, status: "LIVE" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        timezone: true,
        reviewModel: true,
        issnPrint: true,
        issnOnline: true,
        brandingJson: true,
        requiredPolicyKeys: true,
      },
    });
    if (!journal) throw new NotFoundException("Journal not found");
    return journal;
  }

  @UseGuards(SessionGuard)
  @Patch(":journalSlug")
  async update(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = UpdateJournalDto.parse(body);
    const journal = await this.prisma.journal.findFirst({ where: { slug: journalSlug }, select: { id: true } });
    if (!journal) throw new NotFoundException("Journal not found");

    const role = await this.prisma.journalRoleAssignment.findFirst({
      where: { journalId: journal.id, userId: user.id, role: { in: SETTINGS_ROLES } },
      select: { id: true },
    });
    if (!role) throw new NotFoundException("Journal not found");

    const updated = await this.prisma.journal.update({
      where: { id: journal.id },
      data: {
        title: dto.title,
        description: dto.description,
        issnPrint: dto.issnPrint,
        issnOnline: dto.issnOnline,
        timezone: dto.timezone,
        brandingJson: dto.brandingJson,
        requiredPolicyKeys: dto.requiredPolicyKeys,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        timezone: true,
        reviewModel: true,
        issnPrint: true,
        issnOnline: true,
        brandingJson: true,
        requiredPolicyKeys: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        journalId: journal.id,
        actorUserId: user.id,
        action: "journal.update_settings",
        entityType: "Journal",
        entityId: journal.id,
        metadataJson: {
          fields: Object.keys(dto),
        },
      },
    });

    return updated;
  }

  @UseGuards(SessionGuard)
  @Get(":journalSlug/audit-logs")
  async listAuditLogs(@Param("journalSlug") journalSlug: string, @CurrentUser() user: any, @Query("limit") limit?: string) {
    const journal = await this.prisma.journal.findFirst({ where: { slug: journalSlug }, select: { id: true } });
    if (!journal) throw new NotFoundException("Journal not found");

    const role = await this.prisma.journalRoleAssignment.findFirst({
      where: { journalId: journal.id, userId: user.id, role: { in: SETTINGS_ROLES } },
      select: { id: true },
    });
    if (!role) throw new NotFoundException("Journal not found");

    const query = AuditListQueryDto.parse({ limit: limit ?? 50 });

    const items = await this.prisma.auditLog.findMany({
      where: { journalId: journal.id },
      orderBy: { occurredAt: "desc" },
      take: query.limit,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadataJson: true,
        occurredAt: true,
        actorUserId: true,
        actor: { select: { id: true, email: true, name: true } },
      },
    });
    return { items };
  }

  @UseGuards(SessionGuard)
  @Get(":journalSlug/roles")
  async listRoles(@Param("journalSlug") journalSlug: string, @CurrentUser() user: any) {
    const journal = await this.prisma.journal.findFirst({ where: { slug: journalSlug }, select: { id: true } });
    if (!journal) throw new NotFoundException("Journal not found");
    const role = await this.prisma.journalRoleAssignment.findFirst({
      where: { journalId: journal.id, userId: user.id, role: { in: SETTINGS_ROLES } },
      select: { id: true },
    });
    if (!role) throw new NotFoundException("Journal not found");

    const items = await this.prisma.journalRoleAssignment.findMany({
      where: { journalId: journal.id },
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        role: true,
        subscriptionStartAt: true,
        subscriptionEndAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });
    return { items };
  }

  @UseGuards(SessionGuard)
  @Post(":journalSlug/roles")
  async assignRole(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = AssignRoleDto.parse(body);
    if (dto.role !== JournalRole.SUBSCRIBER && (dto.subscriptionStartAt || dto.subscriptionEndAt)) {
      throw new BadRequestException("Subscription dates are only supported for SUBSCRIBER role");
    }
    if (dto.subscriptionStartAt && dto.subscriptionEndAt && new Date(dto.subscriptionStartAt) > new Date(dto.subscriptionEndAt)) {
      throw new BadRequestException("subscriptionStartAt cannot be later than subscriptionEndAt");
    }
    const journal = await this.prisma.journal.findFirst({ where: { slug: journalSlug }, select: { id: true } });
    if (!journal) throw new NotFoundException("Journal not found");
    const adminRole = await this.prisma.journalRoleAssignment.findFirst({
      where: { journalId: journal.id, userId: user.id, role: { in: SETTINGS_ROLES } },
      select: { id: true },
    });
    if (!adminRole) throw new NotFoundException("Journal not found");
    const targetUser = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (!targetUser) throw new NotFoundException("User not found");
    await this.prisma.journalRoleAssignment.upsert({
      where: {
        journalId_userId_role: {
          journalId: journal.id,
          userId: targetUser.id,
          role: dto.role,
        },
      },
      update: {},
      create: {
        journalId: journal.id,
        userId: targetUser.id,
        role: dto.role,
        subscriptionStartAt: dto.role === JournalRole.SUBSCRIBER && dto.subscriptionStartAt ? new Date(dto.subscriptionStartAt) : null,
        subscriptionEndAt: dto.role === JournalRole.SUBSCRIBER && dto.subscriptionEndAt ? new Date(dto.subscriptionEndAt) : null,
      },
    });
    if (dto.role === JournalRole.SUBSCRIBER) {
      await this.prisma.journalRoleAssignment.updateMany({
        where: { journalId: journal.id, userId: targetUser.id, role: JournalRole.SUBSCRIBER },
        data: {
          subscriptionStartAt: dto.subscriptionStartAt ? new Date(dto.subscriptionStartAt) : null,
          subscriptionEndAt: dto.subscriptionEndAt ? new Date(dto.subscriptionEndAt) : null,
        },
      });
    }
    return { ok: true };
  }

  @UseGuards(SessionGuard)
  @Post(":journalSlug/roles/remove")
  async removeRole(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = AssignRoleDto.parse(body);
    const journal = await this.prisma.journal.findFirst({ where: { slug: journalSlug }, select: { id: true } });
    if (!journal) throw new NotFoundException("Journal not found");
    const adminRole = await this.prisma.journalRoleAssignment.findFirst({
      where: { journalId: journal.id, userId: user.id, role: { in: SETTINGS_ROLES } },
      select: { id: true },
    });
    if (!adminRole) throw new NotFoundException("Journal not found");
    const targetUser = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (!targetUser) throw new NotFoundException("User not found");
    await this.prisma.journalRoleAssignment.deleteMany({
      where: { journalId: journal.id, userId: targetUser.id, role: dto.role },
    });
    return { ok: true };
  }
}
