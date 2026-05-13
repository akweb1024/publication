import { BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { Client as PgClient } from "pg";
import type {
  DataSyncRunStatus as DataSyncRunStatusType,
  JournalRole as JournalRoleType,
  StorageProvider as StorageProviderType,
  StorageTarget as StorageTargetType,
} from "@prisma/client";
import { SETTINGS_ROLES, prismaEnum, isDefaultAdminEmail, getDefaultAdminEmail } from "@pub/shared";
import { z } from "zod";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import { JournalResolverService } from "../journal-resolver/journal-resolver.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ConfigService } from "@nestjs/config";
import { decryptJson, encryptJson } from "../storage/secret-crypto.js";
import { StorageService } from "../storage/storage.service.js";

const { DataSyncRunStatus, JournalRole, StorageProvider, StorageTarget } = prismaEnum;

const UpdateJournalDto = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  issnPrint: z.string().nullable().optional(),
  issnOnline: z.string().nullable().optional(),
  timezone: z.string().min(1).optional(),
  brandingJson: z.record(z.any()).optional(),
  requiredPolicyKeys: z.array(z.string().min(1)).optional(),
});
const CreateJournalDto = z.object({
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  title: z.string().min(2).max(200),
  description: z.string().max(4000).optional().nullable(),
  timezone: z.string().min(1).max(120).default("UTC"),
});

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
const SimulateStorageRoutingDto = z.object({
  key: z.string().min(3).max(400),
});
const UpdateDataSyncConfigDto = z.object({
  enabled: z.boolean().optional(),
  autoSyncEnabled: z.boolean().optional(),
  externalDatabaseUrl: z.string().url().optional(),
});
const TestDataSyncDto = z.object({
  externalDatabaseUrl: z.string().url().optional(),
});
const RunDataSyncDto = z.object({
  externalDatabaseUrl: z.string().url().optional(),
});
const DataSyncRunListQueryDto = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

@Controller("journals")
export class JournalsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(JournalResolverService) private readonly journalResolver: JournalResolverService
  ) { }

  private async assertCanManagePlatform(user: { id: string; email?: string | null }) {
    if (isDefaultAdminEmail(user.email)) return;
    const managementRole = await this.prisma.journalRoleAssignment.findFirst({
      where: { userId: user.id, role: { in: SETTINGS_ROLES } },
      select: { id: true },
    });
    if (!managementRole) throw new NotFoundException("Journal not found");
  }

  private async ensureDefaultAdminForAllJournals() {
    const adminEmail = getDefaultAdminEmail();
    if (!adminEmail) return { ok: false, reason: "DEFAULT_ADMIN_EMAIL not configured", affectedJournals: 0 };
    const defaultAdmin = await this.prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true },
    });
    if (!defaultAdmin) return { ok: false, reason: "default admin user not found", affectedJournals: 0 };
    const journals = await this.prisma.journal.findMany({ select: { id: true } });
    if (journals.length === 0) return { ok: true, affectedJournals: 0 };
    await this.prisma.journalRoleAssignment.createMany({
      data: journals.map((journal) => ({
        journalId: journal.id,
        userId: defaultAdmin.id,
        role: JournalRole.JOURNAL_ADMIN,
      })),
      skipDuplicates: true,
    });
    return { ok: true, affectedJournals: journals.length };
  }

  @Get()
  async list() {
    const journals = await this.prisma.journal.findMany({
      where: { status: "LIVE" },
      select: { id: true, slug: true, title: true, description: true, timezone: true },
      orderBy: { createdAt: "asc" },
    });
    return { items: journals };
  }

  @UseGuards(SessionGuard)
  @Post()
  async create(@Body() body: unknown, @CurrentUser() user: any) {
    await this.assertCanManagePlatform(user);
    const dto = CreateJournalDto.parse(body);

    const existing = await this.prisma.journal.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });
    if (existing) throw new BadRequestException("Journal slug already exists");

    let publisher = await this.prisma.publisher.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!publisher) {
      publisher = await this.prisma.publisher.create({
        data: {
          name: "STM Journals",
          defaultLocale: "en",
          supportEmail: user.email ?? "support@stmjournals.com",
        },
        select: { id: true },
      });
    }

    const created = await this.prisma.journal.create({
      data: {
        publisherId: publisher.id,
        slug: dto.slug,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        timezone: dto.timezone.trim() || "UTC",
        status: "LIVE",
      },
      select: { id: true, slug: true, title: true, description: true, timezone: true },
    });

    await this.prisma.journalRoleAssignment.createMany({
      data: [
        { journalId: created.id, userId: user.id, role: JournalRole.JOURNAL_ADMIN },
      ],
      skipDuplicates: true,
    });

    await this.ensureDefaultAdminForAllJournals();

    await this.prisma.auditLog.create({
      data: {
        journalId: created.id,
        actorUserId: user.id,
        action: "journal.create",
        entityType: "Journal",
        entityId: created.id,
        metadataJson: { slug: created.slug, title: created.title },
      },
    });

    return created;
  }

  @UseGuards(SessionGuard)
  @Post("admin/backfill-default-admin")
  async backfillDefaultAdmin(@CurrentUser() user: any) {
    await this.assertCanManagePlatform(user);
    return this.ensureDefaultAdminForAllJournals();
  }

  @Get(":journalSlug")
  async get(@Param("journalSlug") journalSlug: string) {
    const journal = await this.journalResolver.resolveSlugWithStatus(journalSlug, "LIVE", {
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
    });
    return journal;
  }

  @UseGuards(SessionGuard)
  @Patch(":journalSlug")
  async update(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = UpdateJournalDto.parse(body);
    const journal = await this.journalResolver.resolveSlug(journalSlug);

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
    const journal = await this.journalResolver.resolveSlug(journalSlug);

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
    const journal = await this.journalResolver.resolveSlug(journalSlug);
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
    const journal = await this.journalResolver.resolveSlug(journalSlug);
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
    const journal = await this.journalResolver.resolveSlug(journalSlug);
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
    const journal = await this.journalResolver.resolveSlug(journalSlug);
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
    const journal = await this.journalResolver.resolveSlug(journalSlug);
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
    const journal = await this.journalResolver.resolveSlug(journalSlug);
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

  @UseGuards(SessionGuard)
  @Post(":journalSlug/storage-config/simulate")
  async simulateStorageRouting(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = SimulateStorageRoutingDto.parse(body);
    const journal = await this.journalResolver.resolveSlug(journalSlug, { id: true, slug: true });
    const adminRole = await this.prisma.journalRoleAssignment.findFirst({
      where: { journalId: journal.id, userId: user.id, role: { in: SETTINGS_ROLES } },
      select: { id: true },
    });
    if (!adminRole) throw new NotFoundException("Journal not found");

    if (!dto.key.startsWith(`${journal.slug}/`)) {
      throw new BadRequestException(`Key must start with '${journal.slug}/'`);
    }

    const simulation = await this.storage.simulateRouting(dto.key);
    return { key: dto.key, simulation };
  }

  @UseGuards(SessionGuard)
  @Get(":journalSlug/data-sync-config")
  async getDataSyncConfig(@Param("journalSlug") journalSlug: string, @CurrentUser() user: any) {
    const journal = await this.requireAdminJournalAccess(journalSlug, user.id);
    const row = await this.prisma.journalDataSyncConfig.findUnique({
      where: { journalId: journal.id },
      select: {
        enabled: true,
        autoSyncEnabled: true,
        hasValidatedConnection: true,
        lastTestedAt: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncMessage: true,
        encryptedDatabaseUrl: true,
      },
    });
    if (!row) {
      return {
        enabled: false,
        autoSyncEnabled: false,
        hasValidatedConnection: false,
        hasExternalDatabaseUrl: false,
        lastTestedAt: null,
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncMessage: null,
      };
    }
    return {
      enabled: row.enabled,
      autoSyncEnabled: row.autoSyncEnabled,
      hasValidatedConnection: row.hasValidatedConnection,
      hasExternalDatabaseUrl: !!row.encryptedDatabaseUrl,
      lastTestedAt: row.lastTestedAt,
      lastSyncAt: row.lastSyncAt,
      lastSyncStatus: row.lastSyncStatus,
      lastSyncMessage: row.lastSyncMessage,
    };
  }

  @UseGuards(SessionGuard)
  @Patch(":journalSlug/data-sync-config")
  async updateDataSyncConfig(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = UpdateDataSyncConfigDto.parse(body);
    const journal = await this.requireAdminJournalAccess(journalSlug, user.id);
    const encryptionKey = this.getEncryptionKey();
    const encryptedDatabaseUrl = dto.externalDatabaseUrl ? encryptJson({ databaseUrl: dto.externalDatabaseUrl }, encryptionKey) : undefined;

    const updated = await this.prisma.journalDataSyncConfig.upsert({
      where: { journalId: journal.id },
      update: {
        enabled: dto.enabled,
        autoSyncEnabled: dto.autoSyncEnabled,
        encryptedDatabaseUrl,
        hasValidatedConnection: dto.externalDatabaseUrl ? false : undefined,
      },
      create: {
        journalId: journal.id,
        enabled: dto.enabled ?? false,
        autoSyncEnabled: dto.autoSyncEnabled ?? false,
        encryptedDatabaseUrl: encryptedDatabaseUrl ?? null,
      },
      select: {
        enabled: true,
        autoSyncEnabled: true,
        hasValidatedConnection: true,
        lastTestedAt: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncMessage: true,
        encryptedDatabaseUrl: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        journalId: journal.id,
        actorUserId: user.id,
        action: "journal.update_data_sync_config",
        entityType: "JournalDataSyncConfig",
        entityId: journal.id,
        metadataJson: {
          updatedFields: Object.keys(dto).filter((key) => key !== "externalDatabaseUrl"),
          databaseUrlUpdated: !!dto.externalDatabaseUrl,
        },
      },
    });

    return {
      enabled: updated.enabled,
      autoSyncEnabled: updated.autoSyncEnabled,
      hasValidatedConnection: updated.hasValidatedConnection,
      hasExternalDatabaseUrl: !!updated.encryptedDatabaseUrl,
      lastTestedAt: updated.lastTestedAt,
      lastSyncAt: updated.lastSyncAt,
      lastSyncStatus: updated.lastSyncStatus,
      lastSyncMessage: updated.lastSyncMessage,
    };
  }

  @UseGuards(SessionGuard)
  @Post(":journalSlug/data-sync-config/test")
  async testDataSyncConfig(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = TestDataSyncDto.parse(body);
    const journal = await this.requireAdminJournalAccess(journalSlug, user.id);
    const databaseUrl = dto.externalDatabaseUrl ?? (await this.getStoredExternalDatabaseUrl(journal.id));
    if (!databaseUrl) {
      throw new BadRequestException("External database URL is not configured");
    }
    await this.testExternalDatabase(databaseUrl);
    await this.prisma.journalDataSyncConfig.upsert({
      where: { journalId: journal.id },
      update: { hasValidatedConnection: true, lastTestedAt: new Date() },
      create: { journalId: journal.id, hasValidatedConnection: true, lastTestedAt: new Date() },
    });
    return { ok: true };
  }

  @UseGuards(SessionGuard)
  @Post(":journalSlug/data-sync/sync-now")
  async runDataSyncNow(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: any) {
    const dto = RunDataSyncDto.parse(body);
    const journal = await this.requireAdminJournalAccess(journalSlug, user.id);
    const databaseUrl = dto.externalDatabaseUrl ?? (await this.getStoredExternalDatabaseUrl(journal.id));
    if (!databaseUrl) {
      throw new BadRequestException("External database URL is not configured");
    }

    const run = await this.prisma.journalDataSyncRun.create({
      data: {
        journalId: journal.id,
        status: DataSyncRunStatus.FAILED,
        startedAt: new Date(),
        metadataJson: {},
      },
      select: { id: true },
    });

    try {
      const { recordsSynced } = await this.syncJournalSnapshotToExternalDatabase(journal.id, journal.slug, databaseUrl);
      await this.prisma.journalDataSyncRun.update({
        where: { id: run.id },
        data: {
          status: DataSyncRunStatus.SUCCESS,
          recordsSynced,
          finishedAt: new Date(),
          metadataJson: { recordsSynced },
        },
      });
      await this.prisma.journalDataSyncConfig.upsert({
        where: { journalId: journal.id },
        update: {
          lastSyncAt: new Date(),
          lastSyncStatus: DataSyncRunStatus.SUCCESS,
          lastSyncMessage: `Synced ${recordsSynced} records`,
        },
        create: {
          journalId: journal.id,
          enabled: true,
          lastSyncAt: new Date(),
          lastSyncStatus: DataSyncRunStatus.SUCCESS,
          lastSyncMessage: `Synced ${recordsSynced} records`,
        },
      });
      return { ok: true, runId: run.id, recordsSynced };
    } catch (err: any) {
      const message = err?.message ?? "Unknown error";
      await this.prisma.journalDataSyncRun.update({
        where: { id: run.id },
        data: {
          status: DataSyncRunStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: message,
          metadataJson: { error: message },
        },
      });
      await this.prisma.journalDataSyncConfig.upsert({
        where: { journalId: journal.id },
        update: {
          lastSyncAt: new Date(),
          lastSyncStatus: DataSyncRunStatus.FAILED,
          lastSyncMessage: message,
        },
        create: {
          journalId: journal.id,
          enabled: true,
          lastSyncAt: new Date(),
          lastSyncStatus: DataSyncRunStatus.FAILED,
          lastSyncMessage: message,
        },
      });
      throw new BadRequestException(`Data sync failed: ${message}`);
    }
  }

  @UseGuards(SessionGuard)
  @Get(":journalSlug/data-sync/runs")
  async listDataSyncRuns(@Param("journalSlug") journalSlug: string, @CurrentUser() user: any, @Query("limit") limit?: string) {
    const journal = await this.requireAdminJournalAccess(journalSlug, user.id);
    const query = DataSyncRunListQueryDto.parse({ limit: limit ?? 20 });
    const items = await this.prisma.journalDataSyncRun.findMany({
      where: { journalId: journal.id },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      select: {
        id: true,
        status: true,
        recordsSynced: true,
        startedAt: true,
        finishedAt: true,
        errorMessage: true,
        metadataJson: true,
      },
    });
    return { items };
  }

  private getEncryptionKey() {
    const key = this.config.get<string>("STORAGE_CONFIG_ENCRYPTION_KEY") ?? this.config.get<string>("SESSION_SECRET");
    if (!key) throw new BadRequestException("Server encryption key is not configured");
    return key;
  }

  private async requireAdminJournalAccess(journalSlug: string, userId: string) {
    const journal = await this.journalResolver.resolveSlug(journalSlug, { id: true, slug: true });
    const role = await this.prisma.journalRoleAssignment.findFirst({
      where: { journalId: journal.id, userId, role: { in: SETTINGS_ROLES } },
      select: { id: true },
    });
    if (!role) throw new NotFoundException("Journal not found");
    return journal;
  }

  private async getStoredExternalDatabaseUrl(journalId: string) {
    const row = await this.prisma.journalDataSyncConfig.findUnique({
      where: { journalId },
      select: { encryptedDatabaseUrl: true },
    });
    if (!row?.encryptedDatabaseUrl) return null;
    const decrypted = decryptJson<{ databaseUrl: string }>(row.encryptedDatabaseUrl, this.getEncryptionKey());
    return decrypted.databaseUrl;
  }

  private async testExternalDatabase(databaseUrl: string) {
    const client = new PgClient({ connectionString: databaseUrl });
    try {
      await client.connect();
      await client.query("SELECT 1");
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  private async syncJournalSnapshotToExternalDatabase(journalId: string, journalSlug: string, databaseUrl: string) {
    const [journal, roles, submissions, articles, issues] = await Promise.all([
      this.prisma.journal.findUnique({
        where: { id: journalId },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          timezone: true,
          status: true,
          updatedAt: true,
        },
      }),
      this.prisma.journalRoleAssignment.findMany({
        where: { journalId },
        select: { role: true, user: { select: { email: true, name: true, status: true } }, updatedAt: true },
      }),
      this.prisma.submission.findMany({
        where: { journalId },
        select: { id: true, status: true, manuscriptTitle: true, submittedAt: true, updatedAt: true },
      }),
      this.prisma.article.findMany({
        where: { journalId },
        select: { id: true, title: true, status: true, publishedAt: true, updatedAt: true },
      }),
      this.prisma.issue.findMany({
        where: { journalId },
        select: { id: true, title: true, status: true, publicationDate: true, updatedAt: true },
      }),
    ]);

    const snapshot = {
      journal,
      roles,
      submissions,
      articles,
      issues,
      metrics: {
        roles: roles.length,
        submissions: submissions.length,
        articles: articles.length,
        issues: issues.length,
      },
      generatedAt: new Date().toISOString(),
    };

    const client = new PgClient({ connectionString: databaseUrl });
    try {
      await client.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS publication_sync_snapshots (
          journal_slug TEXT PRIMARY KEY,
          snapshot JSONB NOT NULL,
          synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(
        `INSERT INTO publication_sync_snapshots (journal_slug, snapshot, synced_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (journal_slug)
         DO UPDATE SET snapshot = EXCLUDED.snapshot, synced_at = EXCLUDED.synced_at`,
        [journalSlug, JSON.stringify(snapshot)]
      );
    } finally {
      await client.end().catch(() => undefined);
    }

    return {
      recordsSynced:
        (journal ? 1 : 0) + roles.length + submissions.length + articles.length + issues.length,
    };
  }
}
