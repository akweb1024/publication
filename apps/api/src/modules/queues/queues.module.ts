import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_EMAIL } from "@pub/shared";
import { EmailQueueService } from "./queues.service.js";

@Global()
@Module({
  providers: [
    {
      provide: "REDIS_CONNECTION",
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.getOrThrow<string>("REDIS_URL");
        return new IORedis(redisUrl, { maxRetriesPerRequest: null });
      },
    },
    {
      provide: "EMAIL_QUEUE",
      inject: ["REDIS_CONNECTION"],
      useFactory: (connection: IORedis) => new Queue(QUEUE_EMAIL, { connection }),
    },
    EmailQueueService,
  ],
  exports: ["REDIS_CONNECTION", "EMAIL_QUEUE", EmailQueueService],
})
export class QueuesModule { }
