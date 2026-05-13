import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { CurrentUserType } from "./current-user.decorator.js";
import { PrismaService } from "../prisma/prisma.service.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: CurrentUserType;
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) { }

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const userId = (req as any).session?.get("userId");
    if (!userId || typeof userId !== "string") throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    req.currentUser = { id: user.id, email: user.email, name: user.name, mfaEnabled: user.mfaEnabled };
    return true;
  }
}
