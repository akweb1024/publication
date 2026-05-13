import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, NotFoundException, SetMetadata } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Reflector } from "@nestjs/core";
import type { JournalRole as JournalRoleType } from "@prisma/client";
import { prismaEnum, isDefaultAdminEmail } from "@pub/shared";
import { JournalResolverService } from "../journal-resolver/journal-resolver.service.js";
import { PrismaService } from "../prisma/prisma.service.js";

const META_KEY = "journalRoles";
const { JournalRole } = prismaEnum;

export const RequireJournalRoles = (...roles: JournalRoleType[]) => SetMetadata(META_KEY, roles);

@Injectable()
export class JournalRoleGuard implements CanActivate {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JournalResolverService) private readonly journalResolver: JournalResolverService,
    @Inject(Reflector) private readonly reflector: Reflector
  ) { }

  async canActivate(context: ExecutionContext) {
    const handler = context.getHandler();
    const required = (this.reflector.get<JournalRoleType[]>(META_KEY, handler) ??
      this.reflector.get<JournalRoleType[]>(META_KEY, context.getClass())) as JournalRoleType[] | undefined;
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const user = req.currentUser;
    if (!user) throw new ForbiddenException();
    if (isDefaultAdminEmail(user.email)) return true;

    const journalSlug = (req.params as any)?.journalSlug as string | undefined;
    if (!journalSlug) throw new ForbiddenException("journalSlug param is required for role enforcement");

    const journal = await this.journalResolver.resolveSlug(journalSlug);

    const assignment = await this.prisma.journalRoleAssignment.findFirst({
      where: { journalId: journal.id, userId: user.id, role: { in: required } },
      select: { id: true },
    });
    if (!assignment) throw new ForbiddenException("Insufficient role");
    return true;
  }
}
