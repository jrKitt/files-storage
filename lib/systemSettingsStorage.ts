import crypto from "node:crypto";
import { getAdminDatabase } from "@/lib/firebase-admin";

export interface ApiKeyItem {
  id: string;
  name: string;
  provider: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubConfig {
  owner: string;
  repositories: string[];
  personalAccessToken?: string;
  lastSyncAt?: string;
}

export interface SystemSettingsData {
  apiKeys: ApiKeyItem[];
  github: GitHubConfig;
}

interface PublicApiKeyItem {
  id: string;
  name: string;
  provider: string;
  maskedValue: string;
  createdAt: string;
  updatedAt: string;
}

const SETTINGS_NODE = "appData/systemSettings";

const defaultSettings: SystemSettingsData = {
  apiKeys: [],
  github: {
    owner: "jrkitt",
    repositories: [],
  },
};

async function readSettings(): Promise<SystemSettingsData> {
  try {
    const db = getAdminDatabase();
    const snapshot = await db.ref(SETTINGS_NODE).get();
    const parsed = (snapshot.val() || null) as Partial<SystemSettingsData> | null;

    if (!parsed) {
      return defaultSettings;
    }

    return {
      apiKeys: parsed.apiKeys || [],
      github: {
        owner: parsed.github?.owner || defaultSettings.github.owner,
        repositories: parsed.github?.repositories || [],
        personalAccessToken: parsed.github?.personalAccessToken,
        lastSyncAt: parsed.github?.lastSyncAt,
      },
    };
  } catch {
    return defaultSettings;
  }
}

async function writeSettings(data: SystemSettingsData): Promise<void> {
  const db = getAdminDatabase();
  await db.ref(SETTINGS_NODE).set(data);
}

function maskApiKey(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}******${value.slice(-4)}`;
}

function getEncryptionKey(): Buffer {
  const source =
    process.env.SETTINGS_ENCRYPTION_KEY ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!source) {
    throw new Error("Missing encryption key source. Set SETTINGS_ENCRYPTION_KEY in environment.");
  }

  return crypto.createHash("sha256").update(source).digest();
}

function encryptValue(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptValue(payload: string): string {
  if (!payload.startsWith("enc:v1:")) {
    return payload;
  }

  const parts = payload.split(":");
  if (parts.length !== 5) {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = Buffer.from(parts[2], "base64");
  const tag = Buffer.from(parts[3], "base64");
  const encrypted = Buffer.from(parts[4], "base64");

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString("utf8");
}

function toPublicApiKey(item: ApiKeyItem): PublicApiKeyItem {
  const plain = decryptValue(item.value);
  return {
    id: item.id,
    name: item.name,
    provider: item.provider,
    maskedValue: maskApiKey(plain),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function listApiKeys(): Promise<PublicApiKeyItem[]> {
  const settings = await readSettings();
  return settings.apiKeys.map(toPublicApiKey);
}

export async function addApiKey(input: {
  name: string;
  provider: string;
  value: string;
}): Promise<PublicApiKeyItem> {
  if (!input.name.trim()) {
    throw new Error("API key name is required");
  }

  if (!input.value.trim()) {
    throw new Error("API key value is required");
  }

  const settings = await readSettings();
  const now = new Date().toISOString();
  const nextKey: ApiKeyItem = {
    id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    name: input.name.trim(),
    provider: input.provider.trim() || "custom",
    value: encryptValue(input.value.trim()),
    createdAt: now,
    updatedAt: now,
  };

  settings.apiKeys.unshift(nextKey);
  await writeSettings(settings);
  return toPublicApiKey(nextKey);
}

export async function upsertApiKey(input: {
  name: string;
  provider: string;
  value: string;
}): Promise<PublicApiKeyItem> {
  if (!input.name.trim()) {
    throw new Error("API key name is required");
  }

  if (!input.value.trim()) {
    throw new Error("API key value is required");
  }

  const settings = await readSettings();
  const now = new Date().toISOString();
  const name = input.name.trim();
  const provider = input.provider.trim() || "custom";
  const encrypted = encryptValue(input.value.trim());

  const existingIndex = settings.apiKeys.findIndex(
    (item) => item.name === name && item.provider === provider
  );

  if (existingIndex >= 0) {
    settings.apiKeys[existingIndex] = {
      ...settings.apiKeys[existingIndex],
      value: encrypted,
      updatedAt: now,
    };
    await writeSettings(settings);
    return toPublicApiKey(settings.apiKeys[existingIndex]);
  }

  const created: ApiKeyItem = {
    id: `key_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    name,
    provider,
    value: encrypted,
    createdAt: now,
    updatedAt: now,
  };

  settings.apiKeys.unshift(created);
  await writeSettings(settings);
  return toPublicApiKey(created);
}

export async function revealApiKeyValue(keyId: string): Promise<string> {
  const settings = await readSettings();
  const item = settings.apiKeys.find((entry) => entry.id === keyId);
  if (!item) {
    throw new Error("API key not found");
  }

  return decryptValue(item.value);
}

export async function deleteApiKey(keyId: string): Promise<void> {
  const settings = await readSettings();
  settings.apiKeys = settings.apiKeys.filter((item) => item.id !== keyId);
  await writeSettings(settings);
}

export async function getGitHubConfig(): Promise<GitHubConfig> {
  const settings = await readSettings();
  return settings.github;
}

export async function updateGitHubConfig(input: {
  owner?: string;
  repositories?: string[];
  personalAccessToken?: string;
}): Promise<GitHubConfig> {
  const settings = await readSettings();

  settings.github = {
    ...settings.github,
    owner: input.owner?.trim() || settings.github.owner,
    repositories: input.repositories || settings.github.repositories,
    personalAccessToken:
      input.personalAccessToken === undefined
        ? settings.github.personalAccessToken
        : input.personalAccessToken.trim(),
    lastSyncAt: new Date().toISOString(),
  };

  await writeSettings(settings);
  return settings.github;
}
