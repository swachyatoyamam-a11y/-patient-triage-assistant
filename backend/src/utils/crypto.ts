import crypto from "crypto";
import { env } from "@/config/env";

/**
 * AES-256-GCM helpers for encrypting OAuth tokens before they're written to
 * HealthConnection.accessTokenEnc/refreshTokenEnc — per the project's
 * security requirement, provider credentials/tokens are never stored in
 * plaintext. The Demo provider never calls this (it has no tokens); it only
 * matters once a real OAuth provider like Fitbit is configured.
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  if (!env.HEALTH_TOKEN_ENCRYPTION_KEY) {
    throw new Error(
      "HEALTH_TOKEN_ENCRYPTION_KEY is not configured — required before any real (non-Demo) health-data provider can store a connection."
    );
  }
  const key = Buffer.from(env.HEALTH_TOKEN_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("HEALTH_TOKEN_ENCRYPTION_KEY must decode (base64) to exactly 32 bytes.");
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptToken(ciphertext: string): string {
  const data = Buffer.from(ciphertext, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
