import { Module } from "@nestjs/common";
import { StorageService } from "./storage.service.js";
import { FilesController } from "./files.controller.js";

@Module({
  providers: [StorageService],
  controllers: [FilesController],
  exports: [StorageService],
})
export class FilesModule {}

