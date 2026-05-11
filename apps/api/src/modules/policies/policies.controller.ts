import { Body, Controller, Get, Inject, NotFoundException, Param, Post, UseGuards } from "@nestjs/common";
import { JournalRole } from "@prisma/client";
import { z } from "zod";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JournalRoleGuard } from "../auth/journal-role.guard.js";
import { RequireJournalRoles } from "../auth/journal-role.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import { PrismaService } from "../prisma/prisma.service.js";

const CreatePolicyVersionDto = z.object({
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  contentHtml: z.string().min(1),
  changeNote: z.string().optional(),
});

const ActivatePolicyVersionDto = z.object({
  effectiveFrom: z.string().datetime(),
});

@Controller("journals/:journalSlug/policies")
export class PoliciesController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list(@Param("journalSlug") journalSlug: string) {
    const journal = await this.prisma.journal.findFirst({ where: { slug: journalSlug }, select: { id: true } });
    if (!journal) throw new NotFoundException("Journal not found");

    const docs = await this.prisma.policyDocument.findMany({
      where: { journalId: journal.id },
      select: { key: true, title: true },
      orderBy: { key: "asc" },
    });
    return { items: docs };
  }

  @Get(":key")
  async latest(@Param("journalSlug") journalSlug: string, @Param("key") key: string) {
    const doc = await this.prisma.policyDocument.findFirst({
      where: { journal: { slug: journalSlug }, key },
      select: {
        id: true,
        key: true,
        title: true,
        versions: {
          where: {
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
          },
          orderBy: [{ effectiveFrom: "desc" }, { versionNumber: "desc" }],
          take: 1,
          select: { versionNumber: true, effectiveFrom: true, effectiveTo: true, contentHtml: true, changeNote: true },
        },
      },
    });
    if (!doc) throw new NotFoundException("Policy not found");
    const v = doc.versions[0];
    if (!v) throw new NotFoundException("No active policy version");
    return { key: doc.key, title: doc.title, ...v };
  }

  @Get("active-required")
  async activeRequired(@Param("journalSlug") journalSlug: string) {
    const journal = await this.prisma.journal.findFirst({
      where: { slug: journalSlug },
      select: { id: true, requiredPolicyKeys: true },
    });
    if (!journal) throw new NotFoundException("Journal not found");

    const versions = await this.prisma.policyVersion.findMany({
      where: {
        policyDocument: { journalId: journal.id, key: { in: journal.requiredPolicyKeys } },
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
      },
      select: {
        id: true,
        versionNumber: true,
        policyDocument: { select: { key: true, title: true } },
      },
      orderBy: [{ policyDocument: { key: "asc" } }, { versionNumber: "desc" }],
    });

    return {
      items: versions.map((v) => ({
        policyVersionId: v.id,
        key: v.policyDocument.key,
        title: v.policyDocument.title,
        versionNumber: v.versionNumber,
      })),
    };
  }

  @Get(":key/versions/:n")
  async version(@Param("journalSlug") journalSlug: string, @Param("key") key: string, @Param("n") n: string) {
    const versionNumber = Number(n);
    const pv = await this.prisma.policyVersion.findFirst({
      where: { policyDocument: { journal: { slug: journalSlug }, key }, versionNumber },
      select: {
        versionNumber: true,
        effectiveFrom: true,
        effectiveTo: true,
        contentHtml: true,
        changeNote: true,
        policyDocument: { select: { key: true, title: true } },
      },
    });
    if (!pv) throw new NotFoundException("Policy version not found");
    return { key: pv.policyDocument.key, title: pv.policyDocument.title, ...pv };
  }

  @UseGuards(SessionGuard, JournalRoleGuard)
  @RequireJournalRoles(JournalRole.JOURNAL_ADMIN, JournalRole.MANAGING_EDITOR)
  @Post(":key/versions")
  async createVersion(
    @Param("journalSlug") journalSlug: string,
    @Param("key") key: string,
    @Body() body: unknown,
    @CurrentUser() user: any
  ) {
    const dto = CreatePolicyVersionDto.parse(body);
    const journal = await this.prisma.journal.findFirst({ where: { slug: journalSlug }, select: { id: true } });
    if (!journal) throw new NotFoundException("Journal not found");

    const doc =
      (await this.prisma.policyDocument.findFirst({ where: { journalId: journal.id, key }, select: { id: true } })) ??
      (await this.prisma.policyDocument.create({ data: { journalId: journal.id, key, title: key }, select: { id: true } }));

    const last = await this.prisma.policyVersion.findFirst({
      where: { policyDocumentId: doc.id },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    const pv = await this.prisma.policyVersion.create({
      data: {
        policyDocumentId: doc.id,
        versionNumber: (last?.versionNumber ?? 0) + 1,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        contentHtml: dto.contentHtml,
        changeNote: dto.changeNote,
        publishedByUserId: user.id,
      },
      select: { versionNumber: true, effectiveFrom: true, effectiveTo: true },
    });

    await this.prisma.auditLog.create({
      data: {
        journalId: journal.id,
        actorUserId: user.id,
        action: "policy.publish_version",
        entityType: "PolicyVersion",
        entityId: `${doc.id}:${pv.versionNumber}`,
        metadataJson: { key, versionNumber: pv.versionNumber },
      },
    });

    return pv;
  }

  @UseGuards(SessionGuard, JournalRoleGuard)
  @RequireJournalRoles(JournalRole.JOURNAL_ADMIN, JournalRole.MANAGING_EDITOR)
  @Post(":key/versions/:n/activate")
  async activate(
    @Param("journalSlug") journalSlug: string,
    @Param("key") key: string,
    @Param("n") n: string,
    @Body() body: unknown,
    @CurrentUser() user: any
  ) {
    const dto = ActivatePolicyVersionDto.parse(body);
    const versionNumber = Number(n);
    const journal = await this.prisma.journal.findFirst({ where: { slug: journalSlug }, select: { id: true } });
    if (!journal) throw new NotFoundException("Journal not found");

    const doc = await this.prisma.policyDocument.findFirst({ where: { journalId: journal.id, key }, select: { id: true } });
    if (!doc) throw new NotFoundException("Policy not found");

    const effectiveFrom = new Date(dto.effectiveFrom);
    await this.prisma.$transaction(async (tx) => {
      await tx.policyVersion.updateMany({
        where: { policyDocumentId: doc.id, NOT: { versionNumber } },
        data: { effectiveTo: effectiveFrom },
      });
      await tx.policyVersion.update({
        where: { policyDocumentId_versionNumber: { policyDocumentId: doc.id, versionNumber } },
        data: { effectiveFrom, effectiveTo: null },
      });
    });

    await this.prisma.auditLog.create({
      data: {
        journalId: journal.id,
        actorUserId: user.id,
        action: "policy.activate_version",
        entityType: "PolicyVersion",
        entityId: `${doc.id}:${versionNumber}`,
        metadataJson: { key, versionNumber, effectiveFrom: dto.effectiveFrom },
      },
    });

    return { ok: true };
  }
}
