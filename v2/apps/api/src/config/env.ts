import { config } from "dotenv";
import { z } from "zod";

config({ path: process.env.APP_ENV_FILE || "../../.env" });

const optionalString = z.preprocess(
  (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined,
  z.string().optional(),
);

const optionalEmail = z.preprocess(
  (value) => typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined,
  z.email().optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().default("design-hub-v2"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:4000"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  // z.coerce.boolean() treats any non-empty string (including "false") as true.
  DEMO_MODE: z.preprocess(
    (value) => value === true || value === "true" || value === "1",
    z.boolean(),
  ).default(false),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().default(""),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("7d"),
  APP_TIMEZONE: z.string().default("America/Sao_Paulo"),
  UPLOAD_DIR: z.string().min(1).default("uploads"),
  OPENAI_API_KEY: z.preprocess((value) => value || undefined, z.string().min(20).optional()),
  SMTP_HOST: z.string().min(1).default("smtp.hostinger.com"),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z.preprocess(
    (value) => value === undefined || value === "" ? undefined : value === true || value === "true" || value === "1",
    z.boolean(),
  ).default(true),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM_EMAIL: optionalEmail,
  SMTP_FROM_NAME: z.string().min(1).default("Design Hub"),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(10).max(120).default(30),
  // During the V1 -> V2 cutover, imported users can keep their existing
  // password. The first successful V1 login activates the account in V2 and
  // stores a fresh bcrypt hash locally. These variables can be removed after
  // every account has migrated.
  LEGACY_SUPABASE_URL: z.string().url().optional(),
  LEGACY_SUPABASE_ANON_KEY: optionalString,
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(): AppEnv {
  return envSchema.parse({
    ...process.env,
    // Managed Node hosts commonly provide PORT instead of an app-specific name.
    API_PORT: process.env.PORT || process.env.API_PORT,
  });
}
