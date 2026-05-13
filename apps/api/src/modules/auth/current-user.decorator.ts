import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

/** The shape of the authenticated user object attached to requests by SessionGuard. */
export interface CurrentUserType {
  id: string;
  email: string;
  name: string;
  mfaEnabled?: boolean;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): CurrentUserType | undefined => {
  const req = ctx.switchToHttp().getRequest<FastifyRequest>();
  return req.currentUser;
});
