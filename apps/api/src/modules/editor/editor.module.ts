import { Module } from "@nestjs/common";
import { CommunicationsModule } from "../communications/communications.module.js";
import { EditorController } from "./editor.controller.js";
import { EditorService } from "./editor.service.js";

@Module({
  imports: [CommunicationsModule],
  controllers: [EditorController],
  providers: [EditorService],
})
export class EditorModule {}
