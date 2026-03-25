"use client";

import { useEffect, useState } from "react";
import { addTransactionNotification } from "@/lib/transactionNotifications";

type SettingsTab = "api-keys" | "users" | "security";

interface SettingsPanelProps {
  token: string;
}

interface ApiKeyItem {
  id: string;
  name: string;
  provider: string;
  maskedValue: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceUser {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "editor" | "viewer";
  createdAt: string;
}

const shortenSecret = (value: string): string => {
  if (!value) return "";
  if (value.length <= 28) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
};

export default function SettingsPanel({ token }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("api-keys");

  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [users, setUsers] = useState<WorkspaceUser[]>([]);

  const [keyName, setKeyName] = useState("");
  const [keyProvider, setKeyProvider] = useState("github");
  const [keyValue, setKeyValue] = useState("");

  const [revealTargetId, setRevealTargetId] = useState<string | null>(null);
  const [revealPassword, setRevealPassword] = useState("");
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);

  const loadApiKeys = async () => {
    const response = await fetch("/api/settings/api-keys", {
      headers: { "x-auth-token": token },
    });

    if (!response.ok) {
      throw new Error("Failed to load API keys");
    }

    const data = (await response.json()) as ApiKeyItem[];
    setApiKeys(data);
  };

  const loadUsers = async () => {
    const response = await fetch("/api/users", {
      headers: { "x-auth-token": token },
    });

    if (!response.ok) {
      throw new Error("Failed to load users");
    }

    const data = (await response.json()) as WorkspaceUser[];
    setUsers(data);
  };

  useEffect(() => {
    void Promise.all([loadApiKeys(), loadUsers()]).catch(() => {
      setNotice("Failed to load settings data");
      setIsError(true);
    });
  }, [token]);

  const importFirebaseEnv = async () => {
    setNotice("");
    setIsError(false);

    try {
      const response = await fetch("/api/settings/firebase/import-env", {
        method: "POST",
        headers: { "x-auth-token": token },
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to import Firebase env values");
      }

      const body = (await response.json()) as { imported: string[] };
      await loadApiKeys();
      setNotice(
        body.imported.length > 0
          ? `Imported ${body.imported.length} Firebase variables into encrypted vault`
          : "No Firebase environment variables were found"
      );
      if (body.imported.length > 0) {
        addTransactionNotification(
          `Imported ${body.imported.length} Firebase variable(s) to encrypted vault`
        );
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unexpected error");
      setIsError(true);
    }
  };

  const revealApiKey = async () => {
    if (!revealTargetId) return;

    setNotice("");
    setIsError(false);

    try {
      const response = await fetch("/api/settings/api-keys/reveal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token,
        },
        body: JSON.stringify({
          id: revealTargetId,
          password: revealPassword,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to reveal API key");
      }

      const body = (await response.json()) as { value: string };
      setRevealedValues((prev) => ({ ...prev, [revealTargetId]: body.value }));
      setRevealTargetId(null);
      setRevealPassword("");
      setNotice("API key revealed for this session");
      addTransactionNotification("Revealed an API key");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unexpected error");
      setIsError(true);
    }
  };

  const createApiKey = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice("");
    setIsError(false);

    try {
      const response = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token,
        },
        body: JSON.stringify({
          name: keyName,
          provider: keyProvider,
          value: keyValue,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to add API key");
      }

      setKeyName("");
      setKeyProvider("github");
      setKeyValue("");
      await loadApiKeys();
      setNotice("API key added successfully");
      addTransactionNotification(`Added API key: ${keyName}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unexpected error");
      setIsError(true);
    }
  };

  const removeApiKey = async (id: string) => {
    setNotice("");
    setIsError(false);

    try {
      const response = await fetch(`/api/settings/api-keys?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "x-auth-token": token },
      });

      if (!response.ok) {
        throw new Error("Failed to delete API key");
      }

      setRevealedValues((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadApiKeys();
      addTransactionNotification("Deleted an API key");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unexpected error");
      setIsError(true);
    }
  };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice("");
    setIsError(false);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token,
        },
        body: JSON.stringify({
          username,
          displayName,
          password,
          role,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to add user");
      }

      setUsername("");
      setDisplayName("");
      setPassword("");
      setRole("editor");
      await loadUsers();
      setNotice("User created successfully");
      addTransactionNotification(`Created user: ${username}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unexpected error");
      setIsError(true);
    }
  };

  const removeUser = async (id: string) => {
    setNotice("");
    setIsError(false);

    try {
      const response = await fetch(`/api/users?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "x-auth-token": token },
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to delete user");
      }

      await loadUsers();
      addTransactionNotification("Deleted a user");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unexpected error");
      setIsError(true);
    }
  };

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice("");
    setIsError(false);

    try {
      const response = await fetch("/api/settings/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to change password");
      }

      setCurrentPassword("");
      setNewPassword("");
      setNotice("Password changed successfully");
      addTransactionNotification("Changed account password");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unexpected error");
      setIsError(true);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-slate-950 px-6 py-6 md:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h1 className="text-2xl font-semibold text-blue-50">System Settings</h1>
          <p className="mt-1 text-sm text-slate-400">Manage system configuration, API keys, users, and security</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {([
              ["api-keys", "API Keys"],
              ["users", "Users"],
              ["security", "Security"],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  activeTab === tab
                    ? "bg-blue-600 text-white"
                    : "border border-slate-700 bg-slate-800 text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {notice && (
          <section
            className={`rounded-lg border px-4 py-3 text-sm ${
              isError
                ? "border-red-900/80 bg-red-950/40 text-red-200"
                : "border-emerald-900/80 bg-emerald-950/40 text-emerald-200"
            }`}
          >
            {notice}
          </section>
        )}

        {activeTab === "api-keys" && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold text-blue-50">API Keys</h2>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={importFirebaseEnv}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 hover:bg-slate-700"
              >
                Import Firebase env from NAS (.env.local)
              </button>
            </div>

            <form onSubmit={createApiKey} className="mt-4 grid gap-3 md:grid-cols-4">
              <input
                value={keyName}
                onChange={(event) => setKeyName(event.target.value)}
                placeholder="Key name"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
              <input
                value={keyProvider}
                onChange={(event) => setKeyProvider(event.target.value)}
                placeholder="Provider"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
              <input
                value={keyValue}
                onChange={(event) => setKeyValue(event.target.value)}
                placeholder="API key"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                Add key
              </button>
            </form>

            <div className="mt-4 space-y-2">
              {apiKeys.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-blue-100">{item.name}</p>
                    <p className="max-w-[640px] truncate text-xs text-slate-400">
                      {item.provider} | {shortenSecret(revealedValues[item.id] || item.maskedValue)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRevealTargetId(item.id);
                        setRevealPassword("");
                      }}
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      Eye
                    </button>
                    <button
                      type="button"
                      onClick={() => removeApiKey(item.id)}
                      className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-red-500 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "users" && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold text-blue-50">Users</h2>

            <form onSubmit={createUser} className="mt-4 grid gap-3 md:grid-cols-5">
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="username"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Display name"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="password"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as "admin" | "editor" | "viewer")}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              >
                <option value="admin">admin</option>
                <option value="editor">editor</option>
                <option value="viewer">viewer</option>
              </select>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                Add user
              </button>
            </form>

            <div className="mt-4 space-y-2">
              {users.map((user) => (
                <article
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-blue-100">{user.displayName} ({user.username})</p>
                    <p className="text-xs text-slate-400">Role: {user.role}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUser(user.id)}
                    className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:border-red-500 hover:text-red-300"
                  >
                    Delete
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "security" && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold text-blue-50">Security</h2>
            <p className="mt-1 text-sm text-slate-400">Change password for the current logged-in account</p>

            <form onSubmit={updatePassword} className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Current password"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="New password"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                Change password
              </button>
            </form>
          </section>
        )}

        {revealTargetId && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold text-blue-50">Reveal API key</h2>
            <p className="mt-1 text-sm text-slate-400">
              Enter your account password to reveal this secret.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                type="password"
                value={revealPassword}
                onChange={(event) => setRevealPassword(event.target.value)}
                placeholder="Password"
                className="min-w-[220px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={revealApiKey}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                Reveal
              </button>
              <button
                type="button"
                onClick={() => {
                  setRevealTargetId(null);
                  setRevealPassword("");
                }}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
