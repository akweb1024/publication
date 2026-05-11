import { Controller, Get, Inject, Res } from "@nestjs/common";
import { FastifyReply } from "fastify";
import { HealthService } from "./health.service.js";

@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  health() {
    return this.healthService.live();
  }

  @Get("ready")
  async ready(@Res({ passthrough: true }) response: FastifyReply) {
    const payload = await this.healthService.ready();
    response.status(payload.ok ? 200 : 503);
    return payload;
  }
}
