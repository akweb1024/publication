import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, NotFoundException, SetMetadata } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Reflector } from "@nestjs/core";
import { JournalRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";

const META_KEY = "journalRoles";

export const RequireJournalRoles = (...roles: JournalRole[]) => SetMetadata(META_KEY, roles);

@Injectable()
export class JournalRoleGuard implements CanActivate {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(Reflector) private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext) {
    const handler = context.getHandler();
    const required = (this.reflector.get<JournalRole[]>(META_KEY, handler) ??
      this.reflector.get<JournalRole[]>(META_KEY, context.getClass())) as JournalRole[] | undefined;
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const user = req.currentUser;
    if (!user) throw new ForbiddenException();

    const journalSlug = (req.params as any)?.journalSlug as string | undefined;
    if (!journalSlug) throw new ForbiddenException("journalSlug param is required for role enforcement");

    const journal = await this.prisma.journal.findFirst({ where: { slug: journalSlug }, select: { id: true } });
    if (!journal) throw new NotFoundException("Journal not found");

    const assignment = await this.prisma.journalRoleAssignment.findFirst({
      where: { journalId: journal.id, userId: user.id, role: { in: required } },
      select: { id: true },
    });
    if (!assignment) throw new ForbiddenException("Insufficient role");
    return true;
  }
}
