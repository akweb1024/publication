import nodemailer from "nodemailer";
import { loadEnv } from "./config.js";

export function createTransport() {
  const env = loadEnv();
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

