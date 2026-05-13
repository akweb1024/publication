import { Module } from "@nestjs/common";
import { JournalsController } from "./journals.controller.js";
import { JournalsService } from "./journals.service.js";
import { FilesModule } from "../storage/files.module.js";

@Module({
  imports: [FilesModule],
  controllers: [JournalsController],
  providers: [JournalsService],
  exports: [JournalsService],
})
export class JournalsModule { }
