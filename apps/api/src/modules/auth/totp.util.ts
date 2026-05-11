import { createHmac, randomBytes } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string) {
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const ch of clean) {
    const val = BASE32_ALPHABET.indexOf(ch);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function base32Encode(buffer: Buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let out = "";
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    out += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }
  return out;
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

function totpAt(secret: string, epochMs: number, stepSeconds = 30, digits = 6) {
  const counter = Math.floor(epochMs / 1000 / stepSeconds);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter & 0xffffffff, 4);

  const key = base32Decode(secret);
  const hmac = createHmac("sha1", key).update(buffer).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const code =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
    (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
    ((hmac[offset + 3] ?? 0) & 0xff);
  const modulo = 10 ** digits;
  return String(code % modulo).padStart(digits, "0");
}

export function verifyTotpCode(secret: string, codeRaw: string, windowSteps = 1) {
  const code = String(codeRaw).trim();
  if (!/^\d{6}$/.test(code)) return false;
  const now = Date.now();
  for (let offset = -windowSteps; offset <= windowSteps; offset += 1) {
    if (totpAt(secret, now + offset * 30_000) === code) return true;
  }
  return false;
}

export function buildOtpAuthUri(secret: string, accountLabel: string, issuer = "Publication Platform") {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
