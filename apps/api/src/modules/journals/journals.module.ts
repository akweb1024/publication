import { Module } from "@nestjs/common";
import { JournalsController } from "./journals.controller.js";

@Module({
  controllers: [JournalsController],
})
export class JournalsModule {}

