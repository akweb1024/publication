import { Worker } from "bullmq";
import IORedis from "ioredis";
import { z } from "zod";
import { loadEnv } from "./config.js";
import { createTransport } from "./emailer.js";
import { EmailJob, QUEUE_EMAIL } from "./queues.js";

const EmailJobSchema = z.object({
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1),
  html: z.string().min(1),
});

function logEvent(level: "info" | "warn" | "error" | "fatal", event: string, fields?: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      level,
      event,
      timestamp: new Date().toISOString(),
      ...(fields ?? {}),
    })
  );
}

async function main() {
  const env = loadEnv();
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const transport = createTransport();

  logEvent("info", "worker.starting", { redisUrl: env.REDIS_URL, smtpHost: env.SMTP_HOST, smtpPort: env.SMTP_PORT });

  const worker = new Worker<EmailJob>(
    QUEUE_EMAIL,
    async (job) => {
      const payload = EmailJobSchema.parse(job.data);
      await transport.sendMail({
        from: env.SMTP_FROM,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });
    },
    { connection }
  );
  worker.on("ready", () => logEvent("info", "worker.ready", { queue: QUEUE_EMAIL }));
  worker.on("active", (job) => logEvent("info", "worker.job.active", { queue: QUEUE_EMAIL, jobId: job.id }));
  worker.on("completed", (job) => logEvent("info", "worker.job.completed", { queue: QUEUE_EMAIL, jobId: job.id }));
  worker.on("failed", (job, error) =>
    logEvent("error", "worker.job.failed", {
      queue: QUEUE_EMAIL,
      jobId: job?.id ?? "unknown",
      errorName: error.name,
      errorMessage: error.message,
    })
  );
  worker.on("error", (error) =>
    logEvent("error", "worker.runtime.error", { queue: QUEUE_EMAIL, errorName: error.name, errorMessage: error.message })
  );
}

process.on("unhandledRejection", (reason) =>
  logEvent("error", "worker.process.unhandledRejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
  })
);

process.on("uncaughtException", (error) =>
  logEvent("fatal", "worker.process.uncaughtException", {
    errorName: error.name,
    errorMessage: error.message,
  })
);

main().catch((err) => {
  logEvent("fatal", "worker.bootstrap.failure", {
    errorName: err?.name ?? "Error",
    errorMessage: err?.message ?? String(err),
  });
  process.exit(1);
});
