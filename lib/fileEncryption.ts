import crypto from "node:crypto";

const MAGIC = Buffer.from("JRK1");
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getFileEncryptionKey(): Buffer {
  const source =
    process.env.FILE_ENCRYPTION_KEY ||
    process.env.SETTINGS_ENCRYPTION_KEY ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!source) {
    throw new Error("Missing file encryption key source. Set FILE_ENCRYPTION_KEY or SETTINGS_ENCRYPTION_KEY.");
  }

  return crypto.createHash("sha256").update(source).digest();
}

export function encryptFileBuffer(input: Buffer): Buffer {
  const key = getFileEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([MAGIC, iv, tag, encrypted]);
}

export function decryptFileBuffer(input: Buffer): Buffer {
  const headerLength = MAGIC.length + IV_LENGTH + TAG_LENGTH;
  if (input.length < headerLength) {
    return input;
  }

  const magic = input.subarray(0, MAGIC.length);
  if (!magic.equals(MAGIC)) {
    return input;
  }

  const ivStart = MAGIC.length;
  const tagStart = ivStart + IV_LENGTH;
  const dataStart = tagStart + TAG_LENGTH;

  const iv = input.subarray(ivStart, tagStart);
  const tag = input.subarray(tagStart, dataStart);
  const encrypted = input.subarray(dataStart);

  const key = getFileEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
