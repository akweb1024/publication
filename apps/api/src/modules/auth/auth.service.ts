import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { JournalRole as JournalRoleType } from "@prisma/client";
import {
  EDITOR_ROLES, MFA_REQUIRED_ROLES, EDITORIAL_ROLES, MANAGEMENT_ROLES,
  prismaEnum, isDefaultAdminEmail, getDefaultAdminEmail,
  ROLE_HIERARCHY_LEVEL, ROLE_TIER, ROLE_LABELS, TIER_LABELS,
  highestTier, highestLevel, type RoleTier,
} from "@pub/shared";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { buildOtpAuthUri, generateTotpSecret, verifyTotpCode } from "./totp.util.js";

const { JournalRole } = prismaEnum;

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
};


@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) { }


  private async ensureDefaultAdminAccess(userId: string) {
    const journals = await this.prisma.journal.findMany({ select: { id: true } });
    if (journals.length === 0) return;
    await this.prisma.journalRoleAssignment.createMany({
      data: journals.map((journal) => ({ journalId: journal.id, userId, role: prismaEnum.JournalRole.JOURNAL_ADMIN })),
      skipDuplicates: true,
    });
  }

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
    if (isDefaultAdminEmail(user.email)) {
      await this.ensureDefaultAdminAccess(user.id);
    }
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

  async loginWithGoogle(idToken: string) {
    const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!googleClientId) throw new UnauthorizedException("Google sign-in is not configured");

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) throw new UnauthorizedException("Invalid Google credential");
    const tokenInfo = (await response.json()) as GoogleTokenInfo;
    if (!tokenInfo.aud || tokenInfo.aud !== googleClientId) throw new UnauthorizedException("Google token audience mismatch");
    const emailVerified = tokenInfo.email_verified === true || tokenInfo.email_verified === "true";
    const email = tokenInfo.email?.trim().toLowerCase();
    if (!emailVerified || !email) throw new UnauthorizedException("Google email is not verified");

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await argon2.hash(`${randomUUID()}-${randomUUID()}`);
      user = await this.prisma.user.create({
        data: {
          email,
          name: tokenInfo.name?.trim() || email.split("@")[0] || "Google User",
          passwordHash,
        },
      });
    }

    if (isDefaultAdminEmail(user.email)) {
      await this.ensureDefaultAdminAccess(user.id);
    }

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
    const isDefaultAdmin = isDefaultAdminEmail(user.email);
    if (isDefaultAdmin) {
      await this.ensureDefaultAdminAccess(user.id);
    }

    const assignments = await this.prisma.journalRoleAssignment.findMany({
      where: { userId },
      select: { role: true, journal: { select: { slug: true, title: true } } },
    });
    const roles = Array.from(new Set(assignments.map((item) => item.role)));
    const effectiveRoles = isDefaultAdmin && !roles.includes(JournalRole.JOURNAL_ADMIN)
      ? [JournalRole.JOURNAL_ADMIN, ...roles] as JournalRoleType[]
      : roles;

    // ── Hierarchy-derived capabilities ──
    const tier = highestTier(effectiveRoles);
    const level = highestLevel(effectiveRoles);
    const isProduction = effectiveRoles.some((r) => ROLE_TIER[r] === "production");
    const isSubscriber = effectiveRoles.includes(JournalRole.SUBSCRIBER);
    const hasEditorial = isDefaultAdmin || effectiveRoles.some((role) => EDITORIAL_ROLES.includes(role));
    const hasManagement = isDefaultAdmin || effectiveRoles.some((role) => MANAGEMENT_ROLES.includes(role));
    // Editorial roles (SECTION_EDITOR, ASSOCIATE_EDITOR) inherit REVIEWER;
    // admin-tier roles override all domain checks.
    const hasReviewer = effectiveRoles.some((role) =>
      role === JournalRole.REVIEWER || ROLE_TIER[role] === "admin" || ROLE_TIER[role] === "editorial"
    );
    // Publishing: editorial-tier admin override OR production-track roles
    const hasPublishing = hasEditorial || isProduction;

    // ── Per-journal role with tier metadata ──
    const journals = assignments.map((item) => ({
      slug: item.journal.slug,
      title: item.journal.title,
      role: item.role,
      roleLabel: ROLE_LABELS[item.role] ?? item.role,
      roleTier: ROLE_TIER[item.role],
      tierLabel: TIER_LABELS[ROLE_TIER[item.role]] ?? ROLE_TIER[item.role],
    }));

    return {
      authenticated: true,
      user,
      roles: effectiveRoles,
      roleTier: tier,
      roleLevel: level,
      tierLabel: TIER_LABELS[tier] ?? tier,
      capabilities: {
        canSubmit: true,
        canReview: hasReviewer,
        canEditorial: hasEditorial,
        canPublishing: hasPublishing,
        canManageJournal: hasManagement,
        canAudit: hasManagement,
        canSecurity: true,
        hasRestrictedAccess: hasEditorial || isSubscriber,
      },
      journals,
    };
  }
}
