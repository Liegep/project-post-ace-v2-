import "fastify";
import type { Pool } from "mysql2/promise";
import type { AppEnv } from "../config/env.js";
import type { AuthContext } from "../modules/auth/auth.types.js";

declare module "fastify" {
  interface HttpErrors {
    unauthorized(message: string): Error & { statusCode: number };
    forbidden(message: string): Error & { statusCode: number };
    notFound(message: string): Error & { statusCode: number };
    badRequest(message: string): Error & { statusCode: number };
    conflict(message: string): Error & { statusCode: number };
  }

  interface FastifyInstance {
    db: Pool;
    appEnv: AppEnv;
    httpErrors: HttpErrors;
  }

  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

export {};
