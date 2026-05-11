import crypto from "node:crypto";

function getKeyMaterial(baseSecret: string) {
  return crypto.createHash("sha256").update(baseSecret).digest();
}

export function encryptJson(plaintext: Record<string, unknown>, baseSecret: string) {
  const key = getKeyMaterial(baseSecret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${body.toString("base64url")}`;
}

export function decryptJson<T = Record<string, unknown>>(ciphertext: string, baseSecret: string): T {
  const [ivRaw, tagRaw, bodyRaw] = ciphertext.split(".");
  if (!ivRaw || !tagRaw || !bodyRaw) {
    throw new Error("Invalid encrypted payload format");
  }
  const key = getKeyMaterial(baseSecret);
  const iv = Buffer.from(ivRaw, "base64url");
  const tag = Buffer.from(tagRaw, "base64url");
  const body = Buffer.from(bodyRaw, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  return JSON.parse(json) as T;
}
