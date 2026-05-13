import { Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type {
  JournalRole as JournalRoleType,
  StorageProvider as StorageProviderType,
  StorageTarget as StorageTargetType,
} from "@prisma/client";
import { prismaEnum } from "@pub/shared";
import { z } from "zod";
import { CurrentUser, type CurrentUserType } from "../auth/current-user.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import { JournalsService } from "./journals.service.js";

const { JournalRole, StorageProvider, StorageTarget } = prismaEnum;

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
  constructor(@Inject(JournalsService) private readonly journals: JournalsService) { }

  @Get()
  async list() {
    return this.journals.list();
  }

  @UseGuards(SessionGuard)
  @Post()
  async create(@Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = CreateJournalDto.parse(body);
    return this.journals.create(user, dto);
  }

  @UseGuards(SessionGuard)
  @Post("admin/backfill-default-admin")
  async backfillDefaultAdmin(@CurrentUser() user: CurrentUserType) {
    await this.journals.assertCanManagePlatform(user);
    return this.journals.ensureDefaultAdminForAllJournals();
  }

  @Get(":journalSlug")
  async get(@Param("journalSlug") journalSlug: string) {
    return this.journals.get(journalSlug);
  }

  @UseGuards(SessionGuard)
  @Patch(":journalSlug")
  async update(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = UpdateJournalDto.parse(body);
    return this.journals.update(journalSlug, user.id, dto);
  }

  @UseGuards(SessionGuard)
  @Get(":journalSlug/audit-logs")
  async listAuditLogs(@Param("journalSlug") journalSlug: string, @CurrentUser() user: CurrentUserType, @Query("limit") limit?: string) {
    const query = AuditListQueryDto.parse({ limit: limit ?? 50 });
    return this.journals.listAuditLogs(journalSlug, user.id, query.limit);
  }

  @UseGuards(SessionGuard)
  @Get(":journalSlug/roles")
  async listRoles(@Param("journalSlug") journalSlug: string, @CurrentUser() user: CurrentUserType) {
    return this.journals.listRoles(journalSlug, user.id);
  }

  @UseGuards(SessionGuard)
  @Post(":journalSlug/roles")
  async assignRole(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = AssignRoleDto.parse(body);
    return this.journals.assignRole(journalSlug, user.id, dto);
  }

  @UseGuards(SessionGuard)
  @Post(":journalSlug/roles/remove")
  async removeRole(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = AssignRoleDto.parse(body);
    return this.journals.removeRole(journalSlug, user.id, dto);
  }

  @UseGuards(SessionGuard)
  @Get(":journalSlug/storage-config")
  async getStorageConfig(@Param("journalSlug") journalSlug: string, @CurrentUser() user: CurrentUserType) {
    return this.journals.getStorageConfig(journalSlug, user.id);
  }

  @UseGuards(SessionGuard)
  @Patch(":journalSlug/storage-config")
  async updateStorageConfig(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = UpdateStorageConfigDto.parse(body);
    return this.journals.updateStorageConfig(journalSlug, user.id, dto, dto.externalSecrets);
  }

  @UseGuards(SessionGuard)
  @Post(":journalSlug/storage-config/test")
  async testStorageConfig(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = TestStorageConfigDto.parse(body);
    return this.journals.testStorageConfig(journalSlug, user.id, dto);
  }

  @UseGuards(SessionGuard)
  @Post(":journalSlug/storage-config/simulate")
  async simulateStorageRouting(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = SimulateStorageRoutingDto.parse(body);
    return this.journals.simulateStorageRouting(journalSlug, user.id, dto.key);
  }

  @UseGuards(SessionGuard)
  @Get(":journalSlug/data-sync-config")
  async getDataSyncConfig(@Param("journalSlug") journalSlug: string, @CurrentUser() user: CurrentUserType) {
    return this.journals.getDataSyncConfig(journalSlug, user.id);
  }

  @UseGuards(SessionGuard)
  @Patch(":journalSlug/data-sync-config")
  async updateDataSyncConfig(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = UpdateDataSyncConfigDto.parse(body);
    return this.journals.updateDataSyncConfig(journalSlug, user.id, dto);
  }

  @UseGuards(SessionGuard)
  @Post(":journalSlug/data-sync-config/test")
  async testDataSyncConfig(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = TestDataSyncDto.parse(body);
    return this.journals.testDataSyncConfig(journalSlug, user.id, dto.externalDatabaseUrl);
  }

  @UseGuards(SessionGuard)
  @Post(":journalSlug/data-sync/sync-now")
  async runDataSyncNow(@Param("journalSlug") journalSlug: string, @Body() body: unknown, @CurrentUser() user: CurrentUserType) {
    const dto = RunDataSyncDto.parse(body);
    return this.journals.runDataSyncNow(journalSlug, user.id, dto.externalDatabaseUrl);
  }

  @UseGuards(SessionGuard)
  @Get(":journalSlug/data-sync/runs")
  async listDataSyncRuns(@Param("journalSlug") journalSlug: string, @CurrentUser() user: CurrentUserType, @Query("limit") limit?: string) {
    const query = DataSyncRunListQueryDto.parse({ limit: limit ?? 20 });
    return this.journals.listDataSyncRuns(journalSlug, user.id, query.limit);
  }
}
