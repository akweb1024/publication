import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import * as prismaClient from "@prisma/client";
import type { JournalRole as JournalRoleType } from "@prisma/client";
import argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service.js";
import { buildOtpAuthUri, generateTotpSecret, verifyTotpCode } from "./totp.util.js";

const { JournalRole } = prismaClient as { JournalRole: typeof import("@prisma/client").JournalRole };

const MFA_REQUIRED_ROLES: JournalRoleType[] = [
  JournalRole.JOURNAL_ADMIN,
  JournalRole.EDITOR_IN_CHIEF,
  JournalRole.MANAGING_EDITOR,
  JournalRole.SECTION_EDITOR,
  JournalRole.ASSOCIATE_EDITOR,
  JournalRole.COPYEDITOR,
  JournalRole.PRODUCTION_EDITOR,
];
const EDITORIAL_ROLES: JournalRoleType[] = [
  JournalRole.JOURNAL_ADMIN,
  JournalRole.EDITOR_IN_CHIEF,
  JournalRole.MANAGING_EDITOR,
  JournalRole.SECTION_EDITOR,
  JournalRole.ASSOCIATE_EDITOR,
  JournalRole.COPYEDITOR,
  JournalRole.PRODUCTION_EDITOR,
];
const MANAGEMENT_ROLES: JournalRoleType[] = [
  JournalRole.JOURNAL_ADMIN,
  JournalRole.EDITOR_IN_CHIEF,
  JournalRole.MANAGING_EDITOR,
];

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register(input: { email: string; name: string; password: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException("Email already registered");
    const passwordHash = await argon2.hash(input.password);
    return this.prisma.user.create({ data: { email: input.email, name: input.name, passwordHash } });
  }

  async login(input: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new UnauthorizedException("Invalid credentials");
    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    const editorialRole = await this.prisma.journalRoleAssignment.findFirst({
      where: { userId: user.id, role: { in: MFA_REQUIRED_ROLES } },
      select: { id: true },
    });
    const mfaRequired = !!editorialRole || user.mfaEnabled;
    return {
      user,
      mfaRequired,
      mfaEnrollmentRequired: !!editorialRole && !user.mfaEnabled,
    };
  }

  async getUserSafe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, mfaEnabled: user.mfaEnabled };
  }

  async beginMfaEnrollment(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret, mfaEnabled: false, mfaEnabledAt: null },
    });
    return {
      secret,
      otpauthUri: buildOtpAuthUri(secret, user.email),
    };
  }

  async verifyMfaEnrollment(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) throw new UnauthorizedException("MFA enrollment not started");
    const ok = verifyTotpCode(user.mfaSecret, code);
    if (!ok) throw new UnauthorizedException("Invalid MFA code");
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaEnabledAt: new Date() },
    });
    return { ok: true };
  }

  async verifyLoginMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecret) throw new UnauthorizedException("MFA is not enabled");
    const ok = verifyTotpCode(user.mfaSecret, code);
    if (!ok) throw new UnauthorizedException("Invalid MFA code");
    return { ok: true };
  }

  async disableMfa(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null, mfaEnabledAt: null },
    });
    return { ok: true };
  }

  async getNavContext(userId: string | null) {
    if (!userId) return { authenticated: false };
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, mfaEnabled: true },
    });
    if (!user) return { authenticated: false };

    const assignments = await this.prisma.journalRoleAssignment.findMany({
      where: { userId },
      select: { role: true, journal: { select: { slug: true, title: true } } },
    });
    const roles = Array.from(new Set(assignments.map((item) => item.role)));
    const hasEditorial = roles.some((role) => EDITORIAL_ROLES.includes(role));
    const hasManagement = roles.some((role) => MANAGEMENT_ROLES.includes(role));
    const hasReviewer = roles.includes(JournalRole.REVIEWER);
    const hasSubscriber = roles.includes(JournalRole.SUBSCRIBER);

    return {
      authenticated: true,
      user,
      roles,
      capabilities: {
        canSubmit: true,
        canReview: hasReviewer,
        canEditorial: hasEditorial,
        canPublishing: hasEditorial,
        canManageJournal: hasManagement,
        canAudit: hasManagement,
        canSecurity: true,
        hasRestrictedAccess: hasEditorial || hasSubscriber,
      },
      journals: assignments.map((item) => ({ slug: item.journal.slug, title: item.journal.title, role: item.role })),
    };
  }
}
