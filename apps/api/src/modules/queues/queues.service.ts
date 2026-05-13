import { Inject, Injectable } from "@nestjs/common";
import type { Queue } from "bullmq";
import { z } from "zod";
import { QUEUE_EMAIL, type EmailJob } from "@pub/shared";

const EmailJobSchema = z.object({
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1),
  html: z.string().min(1),
});

@Injectable()
export class EmailQueueService {
  constructor(@Inject("EMAIL_QUEUE") private readonly emailQueue: Queue) { }

  async enqueueEmail(job: EmailJob) {
    const payload = EmailJobSchema.parse(job);
    await this.emailQueue.add("send", payload, {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}

