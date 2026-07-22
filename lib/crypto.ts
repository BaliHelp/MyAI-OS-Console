import crypto from "crypto";

const LEGACY_ALGORITHM = "aes-256-cbc";
const ALGORITHM = "aes-256-gcm";
const LEGACY_SALT = "myai-os-salt";

function getSecret(): string {
  const secret = process.env.PROVIDER_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("PROVIDER_KEY_ENCRYPTION_SECRET is not configured");
  }
  return secret;
}

function deriveKey(secret: string, salt: string): Buffer {
  return crypto.scryptSync(secret, salt, 32);
}

/**
 * Encrypt a provider API key for storage.
 *
 * v2 format: "v2:salt_hex:iv_hex:authTag_hex:ciphertext_hex" — AES-256-GCM (authenticated,
 * so a tampered ciphertext fails to decrypt instead of silently returning garbage) with a
 * fresh random salt per encryption, instead of the fixed "myai-os-salt" every key used to
 * share. decryptKey still reads the old "iv_hex:ciphertext_hex" CBC format below — keys
 * encrypted before this change stay readable; only new encryptions use v2.
 */
export function encryptKey(plaintext: string): string {
  const secret = getSecret();
  const salt = crypto.randomBytes(16);
  const key = deriveKey(secret, salt.toString("hex"));
  const iv = crypto.randomBytes(12); // 96-bit IV is the GCM-recommended size
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v2:${salt.toString("hex")}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a provider API key from storage. Handles both the current v2 (GCM) format and the
 * legacy CBC format transparently, so existing rows don't need a migration pass.
 */
export function decryptKey(encrypted: string): string {
  const parts = encrypted.split(":");
  const secret = getSecret();

  if (parts[0] === "v2" && parts.length === 5) {
    const [, saltHex, ivHex, authTagHex, ciphertextHex] = parts;
    const key = deriveKey(secret, saltHex);
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  }

  // Legacy format: "iv_hex:ciphertext_hex", static salt, unauthenticated CBC.
  const [ivHex, ciphertextHex] = parts;
  if (!ivHex || !ciphertextHex) {
    throw new Error("Invalid encrypted key format");
  }
  const key = deriveKey(secret, LEGACY_SALT);
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Get masked representation for display (last 4 chars only).
 * Never exposes the actual key.
 */
export function maskKey(plaintext: string): string {
  if (plaintext.length <= 4) return "••••";
  const last4 = plaintext.slice(-4);
  return `••••••••${last4}`;
}

/**
 * Hash an API key for storage/lookup (one-way, SHA-256).
 * Used for gateway_console.api_keys.key_hash.
 */
export function hashApiKey(fullKey: string): string {
  return crypto.createHash("sha256").update(fullKey).digest("hex");
}
