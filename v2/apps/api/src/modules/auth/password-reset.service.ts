import crypto from "node:crypto";
import nodemailer from "nodemailer";
import type { FastifyInstance } from "fastify";
import { hashPassword } from "./auth.crypto.js";
import { findUserByEmail } from "./auth.repository.js";
import {
  consumePasswordResetToken,
  deletePasswordResetToken,
  ensurePasswordResetTable,
  getLatestPasswordResetRequestAt,
  replacePasswordResetToken,
} from "./password-reset.repository.js";

const MINIMUM_REQUEST_INTERVAL_MS = 60_000;

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function htmlEscape(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

function emailCopy(locale: string) {
  const language = locale.toLowerCase().slice(0, 2);
  const copies = {
    pt: { subject: "Redefina sua senha do Design Hub", greeting: "Olá", intro: "Recebemos um pedido para redefinir sua senha.", action: "Criar nova senha", expiry: "Este link é de uso único e expira em", minutes: "minutos.", ignore: "Se você não fez este pedido, pode ignorar este e-mail." },
    en: { subject: "Reset your Design Hub password", greeting: "Hello", intro: "We received a request to reset your password.", action: "Create new password", expiry: "This single-use link expires in", minutes: "minutes.", ignore: "If you did not request this, you can ignore this email." },
    es: { subject: "Restablece tu contraseña de Design Hub", greeting: "Hola", intro: "Recibimos una solicitud para restablecer tu contraseña.", action: "Crear nueva contraseña", expiry: "Este enlace es de un solo uso y caduca en", minutes: "minutos.", ignore: "Si no hiciste esta solicitud, puedes ignorar este correo." },
    it: { subject: "Reimposta la password di Design Hub", greeting: "Ciao", intro: "Abbiamo ricevuto una richiesta per reimpostare la tua password.", action: "Crea una nuova password", expiry: "Questo link monouso scade tra", minutes: "minuti.", ignore: "Se non hai effettuato questa richiesta, puoi ignorare questa email." },
    sv: { subject: "Återställ ditt lösenord för Design Hub", greeting: "Hej", intro: "Vi har fått en begäran om att återställa ditt lösenord.", action: "Skapa nytt lösenord", expiry: "Den här engångslänken upphör att gälla om", minutes: "minuter.", ignore: "Om du inte gjorde denna begäran kan du ignorera mejlet." },
  } as const;
  return copies[language as keyof typeof copies] ?? copies.pt;
}

function requireMailConfiguration(app: FastifyInstance) {
  const { SMTP_USER, SMTP_PASSWORD } = app.appEnv;
  if (!SMTP_USER || !SMTP_PASSWORD) {
    throw Object.assign(new Error("A recuperação de senha ainda não foi configurada."), { statusCode: 503 });
  }
  return { user: SMTP_USER, pass: SMTP_PASSWORD };
}

export async function requestPasswordReset(app: FastifyInstance, email: string) {
  const credentials = requireMailConfiguration(app);
  await ensurePasswordResetTable(app.db);
  const user = await findUserByEmail(app.db, email);
  if (!user || !user.is_active) return;

  const nowMs = Date.now();
  const latestRequest = await getLatestPasswordResetRequestAt(app.db, user.id);
  if (latestRequest !== null && nowMs - latestRequest < MINIMUM_REQUEST_INTERVAL_MS) return;

  const token = crypto.randomBytes(32).toString("base64url");
  const hashedToken = tokenHash(token);
  const ttlMinutes = app.appEnv.PASSWORD_RESET_TTL_MINUTES;
  await replacePasswordResetToken(app.db, {
    userId: user.id,
    tokenHash: hashedToken,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + ttlMinutes * 60_000,
  });

  const baseUrl = app.appEnv.APP_URL.replace(/\/+$/, "");
  const resetUrl = `${baseUrl}/#/reset-password?token=${encodeURIComponent(token)}`;
  const copy = emailCopy(user.locale);
  const transporter = nodemailer.createTransport({
    host: app.appEnv.SMTP_HOST,
    port: app.appEnv.SMTP_PORT,
    secure: app.appEnv.SMTP_SECURE,
    auth: credentials,
  });

  try {
    await transporter.sendMail({
      from: { name: app.appEnv.SMTP_FROM_NAME, address: app.appEnv.SMTP_FROM_EMAIL ?? credentials.user },
      to: user.email,
      subject: copy.subject,
      text: `${copy.greeting}, ${user.full_name}.\n\n${copy.intro}\n${resetUrl}\n\n${copy.expiry} ${ttlMinutes} ${copy.minutes}\n${copy.ignore}`,
      html: `<div style="margin:0;padding:32px 16px;background:#f5f7ff;font-family:Arial,sans-serif;color:#263250"><div style="max-width:560px;margin:0 auto;padding:32px;border:1px solid #e2e6f2;border-radius:24px;background:#fff"><div style="font-size:13px;font-weight:700;letter-spacing:.12em;color:#6656d7">DESIGN HUB</div><h1 style="margin:18px 0 12px;font-size:28px;line-height:1.15">${copy.greeting}, ${htmlEscape(user.full_name)}.</h1><p style="margin:0 0 24px;color:#65718b;line-height:1.6">${copy.intro}</p><a href="${htmlEscape(resetUrl)}" style="display:inline-block;padding:15px 22px;border-radius:14px;background:linear-gradient(135deg,#3ca7f4,#7a45df);color:#fff;text-decoration:none;font-weight:700">${copy.action}</a><p style="margin:24px 0 0;color:#8791a8;font-size:13px;line-height:1.6">${copy.expiry} ${ttlMinutes} ${copy.minutes}<br>${copy.ignore}</p></div></div>`,
    });
  } catch (error) {
    await deletePasswordResetToken(app.db, hashedToken);
    // The public response must remain identical whether the address exists or
    // not. Log delivery failures without exposing account existence.
    app.log.error(error, "Unable to deliver password reset email");
  }
}

export async function completePasswordReset(app: FastifyInstance, token: string, newPassword: string) {
  await ensurePasswordResetTable(app.db);
  const consumed = await consumePasswordResetToken(app.db, {
    tokenHash: tokenHash(token),
    passwordHash: await hashPassword(newPassword),
    nowMs: Date.now(),
  });
  if (!consumed) throw app.httpErrors.badRequest("Este link é inválido, expirou ou já foi utilizado.");
}
