import { Module } from "@nestjs/common";
import { SubmissionsController } from "./submissions.controller.js";
import { SubmissionsService } from "./submissions.service.js";
import { FilesModule } from "../storage/files.module.js";

@Module({
  imports: [FilesModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
