import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

type EncryptedSecret = {
  encryptedSecret: Buffer;
  secretIv: Buffer;
};

function getSecretKey() {
  const value = process.env.MAIL_SECRET_KEY?.trim();
  if (!value) {
    throw new Error("MAIL_SECRET_KEY is required for encrypted mailbox credential storage.");
  }

  return createHash("sha256").update(value).digest();
}

export function encryptMailboxPassword(password: string): EncryptedSecret {
  const key = getSecretKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encryptedSecret: Buffer.concat([encrypted, tag]),
    secretIv: iv
  };
}

export function decryptMailboxPassword(encryptedSecret: Buffer, secretIv: Buffer) {
  const key = getSecretKey();
  const tag = encryptedSecret.subarray(encryptedSecret.length - 16);
  const ciphertext = encryptedSecret.subarray(0, encryptedSecret.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, secretIv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
