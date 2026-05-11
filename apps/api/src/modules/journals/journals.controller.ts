import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { JournalRole, StorageProvider, StorageTarget } from "@prisma/client";
import { z } from "zod";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ConfigService } from "@nestjs/config";
import { encryptJson } from "../storage/secret-crypto.js";

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
const StorageConfigSecretsDto = z.object({
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
});
const UpdateStorageConfigDto = z.object({
  localPathPrefix: z.string().min(1).max(120).optional(),
  externalPathPrefixes: z.array(z.string().min(1).max(120)).max(20).optional(),
  defaultTarget: z.nativeEnum(StorageTarget).optional(),
  externalProvider: z.nativeEnum(StorageProvider).optional(),
  externalEndpoint: z.string().url().optional().nullable(),
  externalRegion: z.string().min(1).max(120).optional().nullable(),
  externalBucket: z.string().min(1).max(120).optional().nullable(),
  externalForcePathStyle: z.boolean().optional(),
  externalSecrets: StorageConfigSecretsDto.optional(),
});

const TestStorageConfigDto = z.object({
  externalProvider: z.nativeEnum(StorageProvider),
  externalEndpoint: z.string().url(),
  externalRegion: z.string().min(1).max(120),
  externalBucket: z.string().min(1).max(120),
  externalForcePathStyle: z.boolean().default(true),
  externalSecrets: StorageConfigSecretsDto,
});

@Controller("journals")
export class JournalsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService
  ) {}

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

  @UseGuards(SessionGuard)
  @Get(":journalSlug/storage-config")
  async getStorageConfig(@Param("journalSlug") journalSlug: string, @CurrentUser() user: any) {
    const journal = await this.prisma.journal.findFirst({ where: { slug: journalSlug }, select: { id: true } });
    if (!journal) throw new NotFoundException("Journal not found");
    const adminRole = await this.prisma.journalRoleAssignment.findFirst({
      where: { journalId: journal.id, userId: user.id, role: { in: SETTINGS_ROLES } },
      select: { id: true },
    });
    if (!adminRole) throw new NotFoundException("Journal not found");

    const row = await this.prisma.journalStorageConfig.findUnique({
      where: { journalId: journal.id },
      select: {
        localPathPrefix: true,
        externalPathPrefixes: true,
        defaultTarget: true,
        externalProvider: true,
        externalEndpoint: true,
        externalRegion: true,
        externalBucket: true,
        externalForcePathStyle: true,
        secretUpdatedAt: true,
        encryptedSecretJson: true,
      },
    });

    if (!row) {
      return {
        localPathPrefix: "system",
        externalPathPrefixes: ["submissions", "uploads", "manuscripts", "exports"],
        defaultTarget: StorageTarget.EXTERNAL,
        externalProvider: StorageProvider.MINIO,
        externalEndpoint: null,
        externalRegion: null,
        externalBucket: null,
        externalForcePathStyle: true,
        hasExternalSecrets: false,
        secretUpdatedAt: null,
      };
    }

    return {
      localPathPrefix: row.localPathPrefix,
      externalPathPrefixes: row.externalPathPrefixes,
      defaultTarget: row.defaultTarget,
      externalProvider: row.externalProvider,
      externalEndpoint: row.externalEndpoint,
      externalRegion: row.externalRegion,
      externalBucket: row.externalBucket,
      externalForcePathStyle: row.externalForcePathStyle,
      hasExternalSecrets: !!row.encryptedSecretJson,
      secretUpdatedAt: row.secretUpdatedAt,
    };
  }

  @UseGuards(SessionGuard)
  @Patch(":journalSlug/storage-config")
  async updateStorageConfig(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = UpdateStorageConfigDto.parse(body);
    const journal = await this.prisma.journal.findFirst({ where: { slug: journalSlug }, select: { id: true } });
    if (!journal) throw new NotFoundException("Journal not found");
    const adminRole = await this.prisma.journalRoleAssignment.findFirst({
      where: { journalId: journal.id, userId: user.id, role: { in: SETTINGS_ROLES } },
      select: { id: true },
    });
    if (!adminRole) throw new NotFoundException("Journal not found");

    const encryptionKey = this.config.get<string>("STORAGE_CONFIG_ENCRYPTION_KEY") ?? this.config.get<string>("SESSION_SECRET");
    if (!encryptionKey) throw new BadRequestException("Server encryption key is not configured");

    const encryptedSecretJson = dto.externalSecrets ? encryptJson(dto.externalSecrets, encryptionKey) : undefined;
    const updated = await this.prisma.journalStorageConfig.upsert({
      where: { journalId: journal.id },
      update: {
        localPathPrefix: dto.localPathPrefix,
        externalPathPrefixes: dto.externalPathPrefixes,
        defaultTarget: dto.defaultTarget,
        externalProvider: dto.externalProvider,
        externalEndpoint: dto.externalEndpoint,
        externalRegion: dto.externalRegion,
        externalBucket: dto.externalBucket,
        externalForcePathStyle: dto.externalForcePathStyle,
        encryptedSecretJson,
        secretUpdatedAt: dto.externalSecrets ? new Date() : undefined,
        secretVersion: dto.externalSecrets ? { increment: 1 } : undefined,
      },
      create: {
        journalId: journal.id,
        localPathPrefix: dto.localPathPrefix ?? "system",
        externalPathPrefixes: dto.externalPathPrefixes ?? ["submissions", "uploads", "manuscripts", "exports"],
        defaultTarget: dto.defaultTarget ?? StorageTarget.EXTERNAL,
        externalProvider: dto.externalProvider ?? StorageProvider.MINIO,
        externalEndpoint: dto.externalEndpoint ?? null,
        externalRegion: dto.externalRegion ?? null,
        externalBucket: dto.externalBucket ?? null,
        externalForcePathStyle: dto.externalForcePathStyle ?? true,
        encryptedSecretJson: encryptedSecretJson ?? null,
        secretUpdatedAt: dto.externalSecrets ? new Date() : null,
      },
      select: {
        localPathPrefix: true,
        externalPathPrefixes: true,
        defaultTarget: true,
        externalProvider: true,
        externalEndpoint: true,
        externalRegion: true,
        externalBucket: true,
        externalForcePathStyle: true,
        encryptedSecretJson: true,
        secretUpdatedAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        journalId: journal.id,
        actorUserId: user.id,
        action: "journal.update_storage_config",
        entityType: "JournalStorageConfig",
        entityId: journal.id,
        metadataJson: {
          updatedFields: Object.keys(dto).filter((key) => key !== "externalSecrets"),
          secretsUpdated: !!dto.externalSecrets,
        },
      },
    });

    return {
      localPathPrefix: updated.localPathPrefix,
      externalPathPrefixes: updated.externalPathPrefixes,
      defaultTarget: updated.defaultTarget,
      externalProvider: updated.externalProvider,
      externalEndpoint: updated.externalEndpoint,
      externalRegion: updated.externalRegion,
      externalBucket: updated.externalBucket,
      externalForcePathStyle: updated.externalForcePathStyle,
      hasExternalSecrets: !!updated.encryptedSecretJson,
      secretUpdatedAt: updated.secretUpdatedAt,
    };
  }

  @UseGuards(SessionGuard)
  @Post(":journalSlug/storage-config/test")
  async testStorageConfig(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = TestStorageConfigDto.parse(body);
    const journal = await this.prisma.journal.findFirst({ where: { slug: journalSlug }, select: { id: true } });
    if (!journal) throw new NotFoundException("Journal not found");
    const adminRole = await this.prisma.journalRoleAssignment.findFirst({
      where: { journalId: journal.id, userId: user.id, role: { in: SETTINGS_ROLES } },
      select: { id: true },
    });
    if (!adminRole) throw new NotFoundException("Journal not found");

    const client = new S3Client({
      region: dto.externalRegion,
      endpoint: dto.externalEndpoint,
      forcePathStyle: dto.externalForcePathStyle,
      credentials: {
        accessKeyId: dto.externalSecrets.accessKeyId,
        secretAccessKey: dto.externalSecrets.secretAccessKey,
      },
    });

    try {
      await client.send(new HeadBucketCommand({ Bucket: dto.externalBucket }));
      return { ok: true };
    } catch (err: any) {
      throw new BadRequestException(`Storage test failed: ${err?.message ?? "Unknown error"}`);
    }
  }
}
