import { Module } from "@nestjs/common";
import { ReviewerCompatController, ReviewerController } from "./reviewer.controller.js";
import { ReviewerService } from "./reviewer.service.js";

@Module({
  controllers: [ReviewerController, ReviewerCompatController],
  providers: [ReviewerService],
})
export class ReviewerModule {}
