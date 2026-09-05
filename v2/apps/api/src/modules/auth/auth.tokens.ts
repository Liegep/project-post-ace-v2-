import jwt from "jsonwebtoken";
import type { FastifyInstance } from "fastify";
import { appRoles, type AppRole } from "./auth.types.js";

type TokenPayload = {
  sub: string;
  role: AppRole;
  type: "access";
};

export function signAccessToken(
  app: FastifyInstance,
  payload: { userId: string; role: AppRole },
) {
  const expiresIn = app.appEnv.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"];

  return jwt.sign(
    {
      sub: payload.userId,
      role: payload.role,
      type: "access",
    } satisfies TokenPayload,
    app.appEnv.JWT_SECRET,
    {
      expiresIn,
    },
  );
}

export function verifyAccessToken(app: FastifyInstance, token: string) {
  const payload = jwt.verify(token, app.appEnv.JWT_SECRET);
  if (
    typeof payload === "string" ||
    payload.type !== "access" ||
    typeof payload.sub !== "string" ||
    !appRoles.includes(payload.role as AppRole)
  ) {
    throw new jwt.JsonWebTokenError("Invalid application access token");
  }
  return payload as TokenPayload;
}
