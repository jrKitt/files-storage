"use client";

import { useEffect, useMemo, useState } from "react";
import { addTransactionNotification } from "@/lib/transactionNotifications";

interface GitHubManagementProps {
  token: string;
  canEdit: boolean;
}

interface GitHubRepo {
  id: number;
  name: string;
  url: string;
  private: boolean;
  description: string | null;
  updatedAt: string;
  stars: number;
}

interface GitHubResponse {
  owner: string;
  repositories: GitHubRepo[];
  pinnedRepositories: string[];
  source: "github" | "local";
}

export default function GitHubManagement({ token, canEdit }: GitHubManagementProps) {
  const [owner, setOwner] = useState("jrkitt");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [pinnedRepos, setPinnedRepos] = useState<string[]>([]);
  const [pat, setPat] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);

  const pinnedSet = useMemo(() => new Set(pinnedRepos), [pinnedRepos]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/github", {
        headers: { "x-auth-token": token },
      });

      if (!response.ok) {
        throw new Error("Failed to load GitHub data");
      }

      const data = (await response.json()) as GitHubResponse;
      setOwner(data.owner);
      setRepos(data.repositories);
      setPinnedRepos(data.pinnedRepositories);
      setNotice(data.source === "github" ? "GitHub connection successful" : "Using local fallback data");
      setIsError(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unexpected error");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const saveConfig = async () => {
    setNotice("");
    setIsError(false);

    try {
      const response = await fetch("/api/github", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token,
        },
        body: JSON.stringify({
          owner,
          repositories: pinnedRepos,
          personalAccessToken: pat || undefined,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to save config");
      }

      setPat("");
      await load();
      setNotice("GitHub config saved");
      addTransactionNotification("Saved GitHub configuration");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unexpected error");
      setIsError(true);
    }
  };

  const togglePin = (name: string) => {
    setPinnedRepos((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  return (
    <main className="flex-1 overflow-y-auto bg-slate-950 px-6 py-6 md:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h1 className="text-2xl font-semibold text-blue-50">GitHub Management</h1>
          <p className="mt-1 text-sm text-slate-400">Manage menu entries and repositories from github.com/jrkitt</p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <input
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              placeholder="GitHub owner"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              disabled={!canEdit}
            />
            <input
              value={pat}
              onChange={(event) => setPat(event.target.value)}
              type="password"
              placeholder="GitHub PAT (optional)"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              disabled={!canEdit}
            />
            <button
              type="button"
              onClick={saveConfig}
              disabled={!canEdit}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Save config
            </button>
          </div>

          {notice && (
            <div
              className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                isError
                  ? "border-red-900/80 bg-red-950/40 text-red-200"
                  : "border-emerald-900/80 bg-emerald-950/40 text-emerald-200"
              }`}
            >
              {notice}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold text-blue-50">Repositories</h2>

          {loading ? (
            <p className="mt-3 text-sm text-slate-400">Loading data...</p>
          ) : repos.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No repositories found</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {repos.map((repo) => {
                const pinned = pinnedSet.has(repo.name);
                return (
                  <article
                    key={repo.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-200 underline decoration-blue-700 underline-offset-4"
                        >
                          {repo.name}
                        </a>
                        <p className="mt-1 text-xs text-slate-400">{repo.description || "No description"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {repo.private ? "private" : "public"} | stars: {repo.stars}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => togglePin(repo.name)}
                        disabled={!canEdit}
                        className={`rounded-md px-2 py-1 text-xs ${
                          pinned
                            ? "bg-blue-600 text-white"
                            : "border border-slate-700 bg-slate-800 text-slate-200"
                        }`}
                      >
                        {pinned ? "Pinned" : "Pin"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
