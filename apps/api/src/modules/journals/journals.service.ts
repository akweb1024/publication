import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { Client as PgClient } from "pg";
import type {
    DataSyncRunStatus as DataSyncRunStatusType,
    JournalRole as JournalRoleType,
    StorageProvider as StorageProviderType,
    StorageTarget as StorageTargetType,
} from "@prisma/client";
import { SETTINGS_ROLES, prismaEnum, isDefaultAdminEmail, getDefaultAdminEmail } from "@pub/shared";
import type { CurrentUserType } from "../auth/current-user.decorator.js";
import { JournalResolverService } from "../journal-resolver/journal-resolver.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ConfigService } from "@nestjs/config";
import { decryptJson, encryptJson } from "../storage/secret-crypto.js";
import { StorageService } from "../storage/storage.service.js";

const { DataSyncRunStatus, JournalRole, StorageProvider, StorageTarget } = prismaEnum;

@Injectable()
export class JournalsService {
    constructor(
        @Inject(PrismaService) private readonly prisma: PrismaService,
        @Inject(ConfigService) private readonly config: ConfigService,
        @Inject(StorageService) private readonly storage: StorageService,
        @Inject(JournalResolverService) private readonly journalResolver: JournalResolverService
    ) { }

    async assertCanManagePlatform(user: { id: string; email?: string | null }) {
        if (isDefaultAdminEmail(user.email)) return;
        const managementRole = await this.prisma.journalRoleAssignment.findFirst({
            where: { userId: user.id, role: { in: SETTINGS_ROLES } },
            select: { id: true },
        });
        if (!managementRole) throw new NotFoundException("Journal not found");
    }

    async ensureDefaultAdminForAllJournals() {
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

    async list() {
        const journals = await this.prisma.journal.findMany({
            where: { status: "LIVE" },
            select: { id: true, slug: true, title: true, description: true, timezone: true },
            orderBy: { createdAt: "asc" },
        });
        return { items: journals };
    }

    async create(user: CurrentUserType, dto: { slug: string; title: string; description?: string | null; timezone: string }) {
        await this.assertCanManagePlatform(user);

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

    async get(journalSlug: string) {
        return this.journalResolver.resolveSlugWithStatus(journalSlug, "LIVE", {
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
    }

    async update(journalSlug: string, userId: string, dto: Record<string, unknown>) {
        const journal = await this.journalResolver.resolveSlug(journalSlug);

        const role = await this.prisma.journalRoleAssignment.findFirst({
            where: { journalId: journal.id, userId, role: { in: SETTINGS_ROLES } },
            select: { id: true },
        });
        if (!role) throw new NotFoundException("Journal not found");

        const updated = await this.prisma.journal.update({
            where: { id: journal.id },
            data: dto,
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
                actorUserId: userId,
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

    async listAuditLogs(journalSlug: string, userId: string, limit: number) {
        const journal = await this.journalResolver.resolveSlug(journalSlug);

        const role = await this.prisma.journalRoleAssignment.findFirst({
            where: { journalId: journal.id, userId, role: { in: SETTINGS_ROLES } },
            select: { id: true },
        });
        if (!role) throw new NotFoundException("Journal not found");

        const items = await this.prisma.auditLog.findMany({
            where: { journalId: journal.id },
            orderBy: { occurredAt: "desc" },
            take: limit,
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

    async listRoles(journalSlug: string, userId: string) {
        const journal = await this.journalResolver.resolveSlug(journalSlug);
        const role = await this.prisma.journalRoleAssignment.findFirst({
            where: { journalId: journal.id, userId, role: { in: SETTINGS_ROLES } },
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

    async assignRole(journalSlug: string, userId: string, dto: { email: string; role: JournalRoleType; subscriptionStartAt?: string; subscriptionEndAt?: string }) {
        if (dto.role !== JournalRole.SUBSCRIBER && (dto.subscriptionStartAt || dto.subscriptionEndAt)) {
            throw new BadRequestException("Subscription dates are only supported for SUBSCRIBER role");
        }
        if (dto.subscriptionStartAt && dto.subscriptionEndAt && new Date(dto.subscriptionStartAt) > new Date(dto.subscriptionEndAt)) {
            throw new BadRequestException("subscriptionStartAt cannot be later than subscriptionEndAt");
        }
        const journal = await this.journalResolver.resolveSlug(journalSlug);
        const adminRole = await this.prisma.journalRoleAssignment.findFirst({
            where: { journalId: journal.id, userId, role: { in: SETTINGS_ROLES } },
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

    async removeRole(journalSlug: string, userId: string, dto: { email: string; role: JournalRoleType }) {
        const journal = await this.journalResolver.resolveSlug(journalSlug);
        const adminRole = await this.prisma.journalRoleAssignment.findFirst({
            where: { journalId: journal.id, userId, role: { in: SETTINGS_ROLES } },
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

    async getStorageConfig(journalSlug: string, userId: string) {
        const journal = await this.journalResolver.resolveSlug(journalSlug);
        const adminRole = await this.prisma.journalRoleAssignment.findFirst({
            where: { journalId: journal.id, userId, role: { in: SETTINGS_ROLES } },
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

    async updateStorageConfig(
        journalSlug: string,
        userId: string,
        dto: {
            localPathPrefix?: string;
            externalPathPrefixes?: string[];
            defaultTarget?: StorageTargetType;
            externalProvider?: StorageProviderType;
            externalEndpoint?: string | null;
            externalRegion?: string | null;
            externalBucket?: string | null;
            externalForcePathStyle?: boolean;
        },
        externalSecrets?: { accessKeyId: string; secretAccessKey: string }
    ) {
        const journal = await this.journalResolver.resolveSlug(journalSlug);
        const adminRole = await this.prisma.journalRoleAssignment.findFirst({
            where: { journalId: journal.id, userId, role: { in: SETTINGS_ROLES } },
            select: { id: true },
        });
        if (!adminRole) throw new NotFoundException("Journal not found");

        const encryptionKey = this.getEncryptionKey();
        const encryptedSecretJson = externalSecrets ? encryptJson(externalSecrets, encryptionKey) : undefined;

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
                secretUpdatedAt: externalSecrets ? new Date() : undefined,
                secretVersion: externalSecrets ? { increment: 1 } : undefined,
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
                secretUpdatedAt: externalSecrets ? new Date() : null,
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
                actorUserId: userId,
                action: "journal.update_storage_config",
                entityType: "JournalStorageConfig",
                entityId: journal.id,
                metadataJson: {
                    updatedFields: Object.keys(dto).filter((key) => key !== "externalSecrets"),
                    secretsUpdated: !!externalSecrets,
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

    async testStorageConfig(journalSlug: string, userId: string, dto: { externalProvider: StorageProviderType; externalEndpoint: string; externalRegion: string; externalBucket: string; externalForcePathStyle: boolean; externalSecrets: { accessKeyId: string; secretAccessKey: string } }) {
        const journal = await this.journalResolver.resolveSlug(journalSlug);
        const adminRole = await this.prisma.journalRoleAssignment.findFirst({
            where: { journalId: journal.id, userId, role: { in: SETTINGS_ROLES } },
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

    async simulateStorageRouting(journalSlug: string, userId: string, key: string) {
        const journal = await this.journalResolver.resolveSlug(journalSlug, { id: true, slug: true });
        const adminRole = await this.prisma.journalRoleAssignment.findFirst({
            where: { journalId: journal.id, userId, role: { in: SETTINGS_ROLES } },
            select: { id: true },
        });
        if (!adminRole) throw new NotFoundException("Journal not found");

        if (!key.startsWith(`${journal.slug}/`)) {
            throw new BadRequestException(`Key must start with '${journal.slug}/'`);
        }

        const simulation = await this.storage.simulateRouting(key);
        return { key, simulation };
    }

    async getDataSyncConfig(journalSlug: string, userId: string) {
        const journal = await this.requireAdminJournalAccess(journalSlug, userId);
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

    async updateDataSyncConfig(journalSlug: string, userId: string, dto: { enabled?: boolean; autoSyncEnabled?: boolean; externalDatabaseUrl?: string }) {
        const journal = await this.requireAdminJournalAccess(journalSlug, userId);
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
                actorUserId: userId,
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

    async testDataSyncConfig(journalSlug: string, userId: string, externalDatabaseUrl?: string) {
        const journal = await this.requireAdminJournalAccess(journalSlug, userId);
        const databaseUrl = externalDatabaseUrl ?? (await this.getStoredExternalDatabaseUrl(journal.id));
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

    async runDataSyncNow(journalSlug: string, userId: string, externalDatabaseUrl?: string) {
        const journal = await this.requireAdminJournalAccess(journalSlug, userId);
        const databaseUrl = externalDatabaseUrl ?? (await this.getStoredExternalDatabaseUrl(journal.id));
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

    async listDataSyncRuns(journalSlug: string, userId: string, limit: number) {
        const journal = await this.requireAdminJournalAccess(journalSlug, userId);
        const items = await this.prisma.journalDataSyncRun.findMany({
            where: { journalId: journal.id },
            orderBy: { createdAt: "desc" },
            take: limit,
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

    // --- Private helpers ---

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