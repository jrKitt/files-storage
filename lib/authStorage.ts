import crypto from "node:crypto";
import { getAdminDatabase } from "@/lib/firebase-admin";

export type UserRole = "admin" | "editor" | "viewer";

interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
}

interface SessionData {
  token: string;
  createdAt: string;
  expiresAt: string;
  username?: string;
}

interface AuthData {
  passwordHash?: string;
  users?: AuthUser[];
  sessions: Record<string, SessionData>;
}

export interface PublicAuthUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

const AUTH_NODE = "appData/auth";

async function readAuthData(): Promise<AuthData> {
  try {
    const db = getAdminDatabase();
    const snapshot = await db.ref(AUTH_NODE).get();
    const raw = snapshot.val() as Partial<AuthData> | null;
    if (!raw) {
      return { sessions: {} };
    }

    return {
      passwordHash: raw.passwordHash,
      users: raw.users || [],
      sessions: raw.sessions || {},
    };
  } catch {
    return { sessions: {} };
  }
}

async function writeAuthData(data: AuthData): Promise<void> {
  const db = getAdminDatabase();
  await db.ref(AUTH_NODE).set(data);
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function toPublicUser(user: AuthUser): PublicAuthUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export async function setPassword(password: string): Promise<void> {
  const data = await readAuthData();
  if ((data.users?.length || 0) > 0) {
    throw new Error("Cannot set legacy password when user accounts exist");
  }
  data.passwordHash = hashPassword(password);
  await writeAuthData(data);
}

export async function verifyPassword(password: string, username?: string): Promise<boolean> {
  const data = await readAuthData();

  if ((data.users?.length || 0) > 0) {
    if (!username) return false;
    const account = data.users?.find((user) => user.username === normalizeUsername(username));
    if (!account) return false;
    return account.passwordHash === hashPassword(password);
  }

  if (!data.passwordHash) return false;
  return data.passwordHash === hashPassword(password);
}

export async function createSession(username?: string): Promise<string> {
  const data = await readAuthData();
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  data.sessions[token] = {
    token,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    username,
  };
  
  await writeAuthData(data);
  return token;
}

export async function validateSession(token: string): Promise<boolean> {
  const data = await readAuthData();
  const session = data.sessions[token];
  
  if (!session) return false;
  
  if (new Date(session.expiresAt) < new Date()) {
    delete data.sessions[token];
    await writeAuthData(data);
    return false;
  }
  
  return true;
}

export async function destroySession(token: string): Promise<void> {
  const data = await readAuthData();
  delete data.sessions[token];
  await writeAuthData(data);
}

export async function hasPassword(): Promise<boolean> {
  const data = await readAuthData();
  if ((data.users?.length || 0) > 0) {
    return true;
  }
  return !!data.passwordHash;
}

export async function hasUsers(): Promise<boolean> {
  const data = await readAuthData();
  return (data.users?.length || 0) > 0;
}

export async function listUsers(): Promise<PublicAuthUser[]> {
  const data = await readAuthData();
  return (data.users || []).map(toPublicUser);
}

export async function createUser(input: {
  username: string;
  displayName: string;
  password: string;
  role?: UserRole;
}): Promise<PublicAuthUser> {
  const data = await readAuthData();
  const username = normalizeUsername(input.username);

  if (!username) {
    throw new Error("Username is required");
  }

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error("Username must be 3-32 chars and contain only a-z, 0-9, dot, underscore, dash");
  }

  if ((data.users || []).some((user) => user.username === username)) {
    throw new Error("Username already exists");
  }

  if (!input.password || input.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const nextUser: AuthUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    username,
    displayName: input.displayName.trim() || username,
    role: input.role || "editor",
    passwordHash: hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };

  data.users = [...(data.users || []), nextUser];
  await writeAuthData(data);
  return toPublicUser(nextUser);
}

export async function deleteUser(userId: string): Promise<void> {
  const data = await readAuthData();
  const users = data.users || [];
  const target = users.find((user) => user.id === userId);

  if (!target) {
    throw new Error("User not found");
  }

  data.users = users.filter((user) => user.id !== userId);

  Object.entries(data.sessions).forEach(([token, session]) => {
    if (session.username === target.username) {
      delete data.sessions[token];
    }
  });

  await writeAuthData(data);
}

export async function setUserPasswordByAdmin(userId: string, nextPassword: string): Promise<void> {
  const data = await readAuthData();
  const users = data.users || [];

  if (!nextPassword || nextPassword.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const updated = users.map((user) => {
    if (user.id !== userId) return user;
    return {
      ...user,
      passwordHash: hashPassword(nextPassword),
    };
  });

  if (updated.every((user) => user.id !== userId)) {
    throw new Error("User not found");
  }

  data.users = updated;
  await writeAuthData(data);
}

export async function updateOwnPassword(params: {
  token: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const data = await readAuthData();

  if (!params.newPassword || params.newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters");
  }

  const session = data.sessions[params.token];
  if (!session) {
    throw new Error("Unauthorized");
  }

  const users = data.users || [];
  if (users.length > 0) {
    const index = users.findIndex((user) => user.username === session.username);
    if (index < 0) {
      throw new Error("User not found");
    }

    if (users[index].passwordHash !== hashPassword(params.currentPassword)) {
      throw new Error("Current password is invalid");
    }

    users[index] = {
      ...users[index],
      passwordHash: hashPassword(params.newPassword),
    };

    data.users = users;
    await writeAuthData(data);
    return;
  }

  if (!data.passwordHash || data.passwordHash !== hashPassword(params.currentPassword)) {
    throw new Error("Current password is invalid");
  }

  data.passwordHash = hashPassword(params.newPassword);
  await writeAuthData(data);
}

export async function getSessionUser(token: string): Promise<PublicAuthUser | null> {
  const data = await readAuthData();
  const session = data.sessions[token];
  if (!session?.username) return null;

  const account = (data.users || []).find((user) => user.username === session.username);
  if (!account) return null;
  return toPublicUser(account);
}

export async function verifyPasswordForToken(token: string, password: string): Promise<boolean> {
  const data = await readAuthData();
  const session = data.sessions[token];

  if (!session) {
    return false;
  }

  const users = data.users || [];
  if (users.length > 0) {
    const username = session.username;
    if (!username) return false;

    const account = users.find((user) => user.username === username);
    if (!account) return false;
    return account.passwordHash === hashPassword(password);
  }

  if (!data.passwordHash) {
    return false;
  }

  return data.passwordHash === hashPassword(password);
}
