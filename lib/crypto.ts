import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

function getDerivedKey(): Buffer {
  const secret = process.env.PROVIDER_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("PROVIDER_KEY_ENCRYPTION_SECRET is not configured");
  }
  // Derive a 32-byte key from the secret using scrypt
  return crypto.scryptSync(secret, "myai-os-salt", 32);
}

/**
 * Encrypt a provider API key for storage.
 * Returns format: "iv_hex:ciphertext_hex"
 */
export function encryptKey(plaintext: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a provider API key from storage.
 */
export function decryptKey(encrypted: string): string {
  const [ivHex, ciphertextHex] = encrypted.split(":");
  if (!ivHex || !ciphertextHex) {
    throw new Error("Invalid encrypted key format");
  }
  const key = getDerivedKey();
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
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
