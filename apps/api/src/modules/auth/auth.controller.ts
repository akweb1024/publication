import { Body, Controller, Get, Inject, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { CurrentUser } from "./current-user.decorator.js";
import { SessionGuard } from "./session.guard.js";
import { UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service.js";

const RegisterDto = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const VerifyMfaDto = z.object({
  mfaToken: z.string().min(10),
  code: z.string().min(6).max(6),
});
const MfaTokenOnlyDto = z.object({
  mfaToken: z.string().min(10),
});
const MfaCodeDto = z.object({
  code: z.string().min(6).max(6),
});

type PendingMfa = { userId: string; expiresAt: number; enrollmentRequired: boolean };
const pendingMfaLogins = new Map<string, PendingMfa>();

function issueMfaToken(userId: string, enrollmentRequired: boolean) {
  const token = `${userId}.${Date.now()}.${Math.random().toString(36).slice(2, 12)}`;
  pendingMfaLogins.set(token, { userId, enrollmentRequired, expiresAt: Date.now() + 10 * 60 * 1000 });
  return token;
}

function consumeMfaToken(token: string) {
  const pending = pendingMfaLogins.get(token);
  if (!pending) throw new UnauthorizedException("Invalid MFA token");
  pendingMfaLogins.delete(token);
  if (pending.expiresAt < Date.now()) throw new UnauthorizedException("MFA token expired");
  return pending;
}

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("register")
  async register(@Body() body: unknown, @Req() req: FastifyRequest) {
    const dto = RegisterDto.parse(body);
    const user = await this.auth.register(dto);
    (req as any).session.set("userId", user.id);
    return { id: user.id, email: user.email, name: user.name };
  }

  @Post("login")
  async login(@Body() body: unknown, @Req() req: FastifyRequest) {
    const dto = LoginDto.parse(body);
    const result = await this.auth.login(dto);
    if (result.mfaRequired) {
      const mfaToken = issueMfaToken(result.user.id, result.mfaEnrollmentRequired);
      return {
        mfaRequired: true,
        mfaEnrollmentRequired: result.mfaEnrollmentRequired,
        mfaToken,
      };
    }
    (req as any).session.set("userId", result.user.id);
    return { id: result.user.id, email: result.user.email, name: result.user.name };
  }

  @Post("logout")
  async logout(@Req() req: FastifyRequest) {
    (req as any).session.delete();
    return { ok: true };
  }

  @Get("session")
  async session(@Req() req: FastifyRequest) {
    const userId = (req as any).session.get("userId");
    if (!userId || typeof userId !== "string") throw new UnauthorizedException();
    const user = await this.auth.getUserSafe(userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  @Get("nav-context")
  async navContext(@Req() req: FastifyRequest) {
    const userId = (req as any).session?.get("userId");
    return this.auth.getNavContext(typeof userId === "string" ? userId : null);
  }

  @Post("mfa/enroll-init")
  async mfaEnrollInit(@Body() body: unknown) {
    const dto = MfaTokenOnlyDto.parse(body);
    const pending = consumeMfaToken(dto.mfaToken);
    if (!pending.enrollmentRequired) throw new UnauthorizedException("MFA enrollment not required");
    const setup = await this.auth.beginMfaEnrollment(pending.userId);
    const nextToken = issueMfaToken(pending.userId, true);
    return { ...setup, mfaToken: nextToken };
  }

  @Post("mfa/enroll-verify")
  async mfaEnrollVerify(@Body() body: unknown, @Req() req: FastifyRequest) {
    const dto = VerifyMfaDto.parse(body);
    const pending = consumeMfaToken(dto.mfaToken);
    if (!pending.enrollmentRequired) throw new UnauthorizedException("MFA enrollment not required");
    await this.auth.verifyMfaEnrollment(pending.userId, dto.code);
    (req as any).session.set("userId", pending.userId);
    return await this.auth.getUserSafe(pending.userId);
  }

  @Post("mfa/verify")
  async mfaVerify(@Body() body: unknown, @Req() req: FastifyRequest) {
    const dto = VerifyMfaDto.parse(body);
    const pending = consumeMfaToken(dto.mfaToken);
    await this.auth.verifyLoginMfa(pending.userId, dto.code);
    (req as any).session.set("userId", pending.userId);
    return await this.auth.getUserSafe(pending.userId);
  }

  @UseGuards(SessionGuard)
  @Get("mfa/status")
  async mfaStatus(@CurrentUser() user: any) {
    const safe = await this.auth.getUserSafe(user.id);
    return { mfaEnabled: !!safe?.mfaEnabled };
  }

  @UseGuards(SessionGuard)
  @Post("mfa/setup")
  async mfaSetup(@CurrentUser() user: any) {
    return await this.auth.beginMfaEnrollment(user.id);
  }

  @UseGuards(SessionGuard)
  @Post("mfa/enable")
  async mfaEnable(@CurrentUser() user: any, @Body() body: unknown) {
    const dto = MfaCodeDto.parse(body);
    return await this.auth.verifyMfaEnrollment(user.id, dto.code);
  }

  @UseGuards(SessionGuard)
  @Post("mfa/disable")
  async mfaDisable(@CurrentUser() user: any, @Body() body: unknown) {
    const dto = MfaCodeDto.parse(body);
    await this.auth.verifyLoginMfa(user.id, dto.code);
    await this.auth.disableMfa(user.id);
    return { ok: true };
  }
}
