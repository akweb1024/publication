import { Module } from "@nestjs/common";
import { PoliciesController } from "./policies.controller.js";

@Module({
  controllers: [PoliciesController],
})
export class PoliciesModule {}

