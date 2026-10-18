import crypto from "crypto";

// AES-256-GCM encryption for marketplace credentials/tokens before they are
// stored. The key is derived from CREDENTIALS_ENCRYPTION_KEY, which lives only
// in the server environment (Vercel secret) — never in the browser or database.
function getKey() {
  const passphrase = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!passphrase || passphrase.length < 24) {
    throw new Error("Server is missing CREDENTIALS_ENCRYPTION_KEY (needs at least 24 characters).");
  }
  return crypto.scryptSync(passphrase, "smartsell-credentials-v1", 32);
}

export function encryptCredentials(obj) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

export function decryptCredentials(stored) {
  // Rows saved before encryption existed are plain objects — pass them through.
  if (!stored || stored.v !== 1) return stored;
  const key = getKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(stored.iv, "base64"));
  decipher.setAuthTag(Buffer.from(stored.tag, "base64"));
  const out = Buffer.concat([decipher.update(Buffer.from(stored.data, "base64")), decipher.final()]);
  return JSON.parse(out.toString("utf8"));
}
