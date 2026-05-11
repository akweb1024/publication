import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PrismaService } from "../prisma/prisma.service.js";
import { decryptJson } from "./secret-crypto.js";

type ProviderConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
};

type StorageTarget = "LOCAL" | "EXTERNAL";

type RoutingResolution = {
  source: "default-env" | "journal-config";
  journalSlug: string | null;
  target: StorageTarget;
  provider: "DEFAULT_ENV" | "EXTERNAL_CONFIGURED" | "EXTERNAL_FALLBACK_DEFAULT";
  bucket: string;
  endpoint: string;
  region: string;
  reason: string;
};

@Injectable()
export class StorageService {
  private readonly defaultClient: S3Client;
  private readonly defaultConfig: ProviderConfig;
  private readonly encryptionSecret: string;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {
    this.defaultConfig = {
      endpoint: config.getOrThrow<string>("S3_ENDPOINT"),
      region: config.getOrThrow<string>("S3_REGION"),
      accessKeyId: config.getOrThrow<string>("S3_ACCESS_KEY"),
      secretAccessKey: config.getOrThrow<string>("S3_SECRET_KEY"),
      forcePathStyle: (config.get<string>("S3_FORCE_PATH_STYLE") ?? "false") === "true",
      bucket: config.getOrThrow<string>("S3_BUCKET"),
    };

    this.defaultClient = new S3Client({
      region: this.defaultConfig.region,
      endpoint: this.defaultConfig.endpoint,
      forcePathStyle: this.defaultConfig.forcePathStyle,
      credentials: {
        accessKeyId: this.defaultConfig.accessKeyId,
        secretAccessKey: this.defaultConfig.secretAccessKey,
      },
    });

    this.encryptionSecret =
      config.get<string>("STORAGE_CONFIG_ENCRYPTION_KEY") ?? config.get<string>("SESSION_SECRET") ?? "unsafe-default-key";
  }

  async presignPutObject(key: string, contentType: string) {
    const provider = await this.resolveProvider(key);
    const cmd = new PutObjectCommand({ Bucket: provider.bucket, Key: key, ContentType: contentType });
    return getSignedUrl(provider.client, cmd, { expiresIn: 60 * 10 });
  }

  async presignGetObject(key: string) {
    const provider = await this.resolveProvider(key);
    const cmd = new GetObjectCommand({ Bucket: provider.bucket, Key: key });
    return getSignedUrl(provider.client, cmd, { expiresIn: 60 * 10 });
  }

  async simulateRouting(key: string): Promise<RoutingResolution> {
    const slug = this.extractJournalSlug(key);
    if (!slug) {
      return {
        source: "default-env",
        journalSlug: null,
        target: "LOCAL",
        provider: "DEFAULT_ENV",
        bucket: this.defaultConfig.bucket,
        endpoint: this.defaultConfig.endpoint,
        region: this.defaultConfig.region,
        reason: "No journal slug prefix found in key; default provider selected.",
      };
    }

    const cfg = await this.prisma.journalStorageConfig.findFirst({
      where: { journal: { slug } },
      select: {
        localPathPrefix: true,
        externalPathPrefixes: true,
        defaultTarget: true,
        externalEndpoint: true,
        externalRegion: true,
        externalBucket: true,
        encryptedSecretJson: true,
      },
    });

    if (!cfg) {
      return {
        source: "default-env",
        journalSlug: slug,
        target: "LOCAL",
        provider: "DEFAULT_ENV",
        bucket: this.defaultConfig.bucket,
        endpoint: this.defaultConfig.endpoint,
        region: this.defaultConfig.region,
        reason: "No journal storage config found; default provider selected.",
      };
    }

    const target = this.resolveTargetFromKey(key, cfg.localPathPrefix, cfg.externalPathPrefixes, cfg.defaultTarget as StorageTarget);
    if (target === "LOCAL") {
      return {
        source: "journal-config",
        journalSlug: slug,
        target,
        provider: "DEFAULT_ENV",
        bucket: this.defaultConfig.bucket,
        endpoint: this.defaultConfig.endpoint,
        region: this.defaultConfig.region,
        reason: `Matched local path policy (${cfg.localPathPrefix}).`,
      };
    }

    if (!cfg.externalEndpoint || !cfg.externalRegion || !cfg.externalBucket || !cfg.encryptedSecretJson) {
      return {
        source: "journal-config",
        journalSlug: slug,
        target,
        provider: "EXTERNAL_FALLBACK_DEFAULT",
        bucket: this.defaultConfig.bucket,
        endpoint: this.defaultConfig.endpoint,
        region: this.defaultConfig.region,
        reason: "External target requested but provider config/secrets incomplete; falling back to default provider.",
      };
    }

    try {
      const secrets = decryptJson<{ accessKeyId: string; secretAccessKey: string }>(cfg.encryptedSecretJson, this.encryptionSecret);
      if (!secrets.accessKeyId || !secrets.secretAccessKey) {
        return {
          source: "journal-config",
          journalSlug: slug,
          target,
          provider: "EXTERNAL_FALLBACK_DEFAULT",
          bucket: this.defaultConfig.bucket,
          endpoint: this.defaultConfig.endpoint,
          region: this.defaultConfig.region,
          reason: "External credentials are invalid; falling back to default provider.",
        };
      }
      return {
        source: "journal-config",
        journalSlug: slug,
        target,
        provider: "EXTERNAL_CONFIGURED",
        bucket: cfg.externalBucket,
        endpoint: cfg.externalEndpoint,
        region: cfg.externalRegion,
        reason: "External provider configuration is complete and selected by policy.",
      };
    } catch {
      return {
        source: "journal-config",
        journalSlug: slug,
        target,
        provider: "EXTERNAL_FALLBACK_DEFAULT",
        bucket: this.defaultConfig.bucket,
        endpoint: this.defaultConfig.endpoint,
        region: this.defaultConfig.region,
        reason: "External secret decryption failed; falling back to default provider.",
      };
    }
  }

  private async resolveProvider(key: string) {
    const slug = this.extractJournalSlug(key);
    if (!slug) {
      return { client: this.defaultClient, bucket: this.defaultConfig.bucket };
    }

    const cfg = await this.prisma.journalStorageConfig.findFirst({
      where: { journal: { slug } },
      select: {
        localPathPrefix: true,
        externalPathPrefixes: true,
        defaultTarget: true,
        externalEndpoint: true,
        externalRegion: true,
        externalBucket: true,
        externalForcePathStyle: true,
        encryptedSecretJson: true,
      },
    });

    if (!cfg) {
      return { client: this.defaultClient, bucket: this.defaultConfig.bucket };
    }

    const target = this.resolveTargetFromKey(key, cfg.localPathPrefix, cfg.externalPathPrefixes, cfg.defaultTarget as StorageTarget);
    if (target === "LOCAL") {
      return { client: this.defaultClient, bucket: this.defaultConfig.bucket };
    }

    if (!cfg.externalEndpoint || !cfg.externalRegion || !cfg.externalBucket || !cfg.encryptedSecretJson) {
      return { client: this.defaultClient, bucket: this.defaultConfig.bucket };
    }

    try {
      const secrets = decryptJson<{ accessKeyId: string; secretAccessKey: string }>(cfg.encryptedSecretJson, this.encryptionSecret);
      if (!secrets.accessKeyId || !secrets.secretAccessKey) {
        return { client: this.defaultClient, bucket: this.defaultConfig.bucket };
      }
      const externalClient = new S3Client({
        region: cfg.externalRegion,
        endpoint: cfg.externalEndpoint,
        forcePathStyle: cfg.externalForcePathStyle,
        credentials: {
          accessKeyId: secrets.accessKeyId,
          secretAccessKey: secrets.secretAccessKey,
        },
      });
      return { client: externalClient, bucket: cfg.externalBucket };
    } catch {
      return { client: this.defaultClient, bucket: this.defaultConfig.bucket };
    }
  }

  private resolveTargetFromKey(
    key: string,
    localPathPrefix: string,
    externalPathPrefixes: string[],
    defaultTarget: StorageTarget
  ): StorageTarget {
    const normalized = key.toLowerCase();
    const local = localPathPrefix.trim().toLowerCase();
    const external = externalPathPrefixes.map((value) => value.trim().toLowerCase()).filter(Boolean);

    if (local && normalized.includes(`/${local}/`)) {
      return "LOCAL";
    }
    for (const prefix of external) {
      if (normalized.includes(`/${prefix}/`)) {
        return "EXTERNAL";
      }
    }
    return defaultTarget;
  }

  private extractJournalSlug(key: string): string | null {
    const slug = key.split("/")[0]?.trim();
    if (!slug) return null;
    return slug;
  }
}
