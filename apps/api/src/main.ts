import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import secureSession from "@fastify/secure-session";
import cookie from "@fastify/cookie";
import { AppModule } from "./modules/app.module.js";

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: any) {
  return (
    request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    request.ip ||
    request.socket?.remoteAddress ||
    "unknown"
  );
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: ["error", "warn", "log"],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("/api/v1");
  const fastify = app.getHttpAdapter().getInstance();
  const config = app.get(ConfigService);
  const rateLimitWindowMs = Number(config.get("RATE_LIMIT_WINDOW_MS") ?? 60_000);
  const globalRateLimit = Number(config.get("RATE_LIMIT_MAX") ?? 120);
  const authRateLimit = Number(config.get("RATE_LIMIT_AUTH_MAX") ?? 30);
  const isProduction = config.get("NODE_ENV") === "production";
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateBuckets.entries()) {
      if (value.resetAt <= now) rateBuckets.delete(key);
    }
  }, Math.max(5_000, rateLimitWindowMs)).unref();

  fastify.addHook("onRequest", async (request: any, reply: any) => {
    const incoming = request.headers["x-request-id"];
    const requestId = typeof incoming === "string" && incoming.trim().length > 0 ? incoming : randomUUID();
    (request as any).requestId = requestId;
    reply.header("x-request-id", requestId);
    (request as any).startedAt = Date.now();

    const ip = getClientIp(request);
    const isAuthPath = String(request.url ?? "").includes("/api/v1/auth/");
    const limit = isAuthPath ? authRateLimit : globalRateLimit;
    const bucketKey = `${isAuthPath ? "auth" : "global"}:${ip}`;
    const now = Date.now();
    const existing = rateBuckets.get(bucketKey);
    if (!existing || existing.resetAt <= now) {
      rateBuckets.set(bucketKey, { count: 1, resetAt: now + rateLimitWindowMs });
    } else {
      existing.count += 1;
      rateBuckets.set(bucketKey, existing);
      if (existing.count > limit) {
        reply.status(429);
        return reply.send({
          message: "Too many requests",
          requestId,
        });
      }
    }
  });

  fastify.addHook("onError", async (request: any, reply: any, error: Error) => {
    const requestId = (request as any).requestId ?? "unknown";
    const statusCode = reply.statusCode >= 400 ? reply.statusCode : 500;
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        level: "error",
        event: "api.request.error",
        requestId,
        method: request.method,
        path: request.url,
        statusCode,
        errorName: error.name,
        errorMessage: error.message,
      })
    );
  });

  fastify.addHook("onResponse", async (request: any, reply: any) => {
    const requestId = (request as any).requestId ?? "unknown";
    const startedAt = Number((request as any).startedAt ?? Date.now());
    const durationMs = Math.max(0, Date.now() - startedAt);
    const level = reply.statusCode >= 500 ? "error" : reply.statusCode >= 400 ? "warn" : "info";
    const payload = {
      level,
      event: "api.request.completed",
      requestId,
      method: request.method,
      path: request.url,
      statusCode: reply.statusCode,
      durationMs,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
  });
  const webOriginRaw = config.get("WEB_ORIGIN") ?? "http://localhost:3000,http://127.0.0.1:3000";
  const allowedOrigins = webOriginRaw
    .split(",")
    .map((value: string) => value.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin ${origin}`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  const sessionSecret = config.getOrThrow<string>("SESSION_SECRET");

  await app.register(cookie as any);
  await app.register(secureSession as any, {
    key: Buffer.from(sessionSecret.padEnd(32, "0").slice(0, 32)),
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: (config.get("COOKIE_SAMESITE") as "lax" | "strict" | "none") ?? "lax",
      secure: isProduction,
      maxAge: Number(config.get("SESSION_TTL_SECONDS") ?? 60 * 60 * 12),
    },
  });

  fastify.addHook("onSend", async (_request: any, reply: any, payload: any) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    if (isProduction) {
      reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
    }
    return payload;
  });

  const port = Number(config.get("API_PORT") ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
}

process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      level: "error",
      event: "api.process.unhandledRejection",
      reason: reason instanceof Error ? reason.message : String(reason),
    })
  );
});

process.on("uncaughtException", (error) => {
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      level: "fatal",
      event: "api.process.uncaughtException",
      errorName: error.name,
      errorMessage: error.message,
    })
  );
});

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      level: "fatal",
      event: "api.bootstrap.failure",
      errorName: err?.name ?? "Error",
      errorMessage: err?.message ?? String(err),
    })
  );
  process.exit(1);
});
