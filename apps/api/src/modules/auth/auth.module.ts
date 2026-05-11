import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { SessionGuard } from "./session.guard.js";
import { JournalRoleGuard } from "./journal-role.guard.js";

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, JournalRoleGuard],
  exports: [AuthService, SessionGuard, JournalRoleGuard],
})
export class AuthModule {}
