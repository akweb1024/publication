import { Module } from "@nestjs/common";
import { JournalsController } from "./journals.controller.js";
import { FilesModule } from "../storage/files.module.js";

@Module({
  imports: [FilesModule],
  controllers: [JournalsController],
})
export class JournalsModule {}
