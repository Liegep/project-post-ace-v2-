import { config } from "dotenv";
import { z } from "zod";

config({ path: process.env.APP_ENV_FILE || "../../.env" });

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
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(): AppEnv {
  return envSchema.parse(process.env);
}
