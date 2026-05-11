import { Body, Controller, Get, Inject, Patch, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SessionGuard } from "../auth/session.guard.js";
import { PrismaService } from "../prisma/prisma.service.js";

const PatchMeDto = z.object({
  name: z.string().min(1).optional(),
});

@Controller("me")
export class MeController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @UseGuards(SessionGuard)
  @Get()
  async get(@CurrentUser() user: any) {
    return user;
  }

  @UseGuards(SessionGuard)
  @Patch()
  async patch(@Body() body: unknown, @CurrentUser() user: any) {
    const dto = PatchMeDto.parse(body);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { ...(dto.name ? { name: dto.name } : {}) },
      select: { id: true, email: true, name: true, mfaEnabled: true },
    });
    return updated;
  }
}
