import { Inject, Injectable } from "@nestjs/common";
import type IORedis from "ioredis";
import { PrismaService } from "../prisma/prisma.service.js";

type DependencyState = "up" | "down";

export type ReadinessPayload = {
  ok: boolean;
  status: "ok" | "degraded";
  timestamp: string;
  checks: {
    database: DependencyState;
    redis: DependencyState;
  };
};

@Injectable()
export class HealthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject("REDIS_CONNECTION") private readonly redis: IORedis
  ) {}

  live() {
    return { ok: true, status: "ok", timestamp: new Date().toISOString() } as const;
  }

  async ready(): Promise<ReadinessPayload> {
    const checks: ReadinessPayload["checks"] = {
      database: "down",
      redis: "down",
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = "up";
    } catch {}

    try {
      const pong = await this.redis.ping();
      checks.redis = pong === "PONG" ? "up" : "down";
    } catch {}

    const ok = checks.database === "up" && checks.redis === "up";
    return {
      ok,
      status: ok ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}

