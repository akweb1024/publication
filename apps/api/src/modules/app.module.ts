import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./health/health.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { JournalResolverModule } from "./journal-resolver/journal-resolver.module.js";
import { JournalsModule } from "./journals/journals.module.js";
import { PoliciesModule } from "./policies/policies.module.js";
import { QueuesModule } from "./queues/queues.module.js";
import { SubmissionsModule } from "./submissions/submissions.module.js";
import { EditorModule } from "./editor/editor.module.js";
import { ReviewerModule } from "./reviewer/reviewer.module.js";
import { PublishingModule } from "./publishing/publishing.module.js";
import { ProductionModule } from "./production/production.module.js";
import { FilesModule } from "./storage/files.module.js";
import { UsersModule } from "./users/users.module.js";
import { AgentModule } from "./agent/agent.module.js";
import { PublicModule } from "./public/public.module.js";
import { CommunicationsModule } from "./communications/communications.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env.local", "../../.env", ".env.local", ".env"],
    }),
    PrismaModule,
    JournalResolverModule,
    QueuesModule,
    HealthModule,
    AuthModule,
    JournalsModule,
    PoliciesModule,
    SubmissionsModule,
    EditorModule,
    ReviewerModule,
    ProductionModule,
    PublishingModule,
    FilesModule,
    UsersModule,
    AgentModule,
    CommunicationsModule,
    PublicModule
  ],
})
export class AppModule { }
