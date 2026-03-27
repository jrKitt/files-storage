"use client";

import { useEffect, useMemo, useState } from "react";

interface GitHubProjectStatus {
  id: number;
  name: string;
  repoUrl: string;
  projectUrl: string | null;
  status: "online" | "offline" | "unknown";
  statusCode?: number;
  responseTimeMs?: number;
  updatedAt: string;
}

interface GitHubStatusResponse {
  owner: string;
  checkedAt: string;
  total: number;
  onlineCount: number;
  offlineCount: number;
  unknownCount: number;
  projects: GitHubProjectStatus[];
}

interface GitHubStatusDashboardProps {
  token: string;
}

function formatCheckedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatusLabel(status: GitHubProjectStatus["status"]): string {
  if (status === "online") return "Online";
  if (status === "offline") return "Offline";
  return "No URL";
}

export default function GitHubStatusDashboard({ token }: GitHubStatusDashboardProps) {
  const [data, setData] = useState<GitHubStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStatus = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/github/status", {
        headers: { "x-auth-token": token },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to load GitHub project status");
      }

      const payload = (await response.json()) as GitHubStatusResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, [token]);

  const onlinePercent = useMemo(() => {
    if (!data || data.total === 0) return 0;
    return Math.round((data.onlineCount / data.total) * 100);
  }, [data]);

  return (
    <main className="flex-1 overflow-y-auto bg-slate-950 px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">GitHub Monitor</p>
              <h1 className="mt-1 text-2xl font-semibold text-emerald-50 md:text-3xl">Project Status Board</h1>
              <p className="mt-1 text-sm text-slate-400">Realtime health check for projects under github.com/jrkitt</p>
            </div>

            <button
              type="button"
              onClick={() => {
                void loadStatus();
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-slate-400">Checking project status...</p>
          ) : error ? (
            <div className="mt-4 rounded-lg border border-red-900/80 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : data ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-xl border border-emerald-900/60 bg-emerald-950/40 p-4">
                  <p className="text-xs uppercase tracking-wider text-emerald-300">Online</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-100">{data.onlineCount}</p>
                </article>
                <article className="rounded-xl border border-rose-900/60 bg-rose-950/30 p-4">
                  <p className="text-xs uppercase tracking-wider text-rose-300">Offline</p>
                  <p className="mt-2 text-2xl font-semibold text-rose-100">{data.offlineCount}</p>
                </article>
                <article className="rounded-xl border border-amber-900/60 bg-amber-950/30 p-4">
                  <p className="text-xs uppercase tracking-wider text-amber-300">No URL</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-100">{data.unknownCount}</p>
                </article>
                <article className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-400">Checked at</p>
                  <p className="mt-2 text-sm font-medium text-slate-100">{formatCheckedAt(data.checkedAt)}</p>
                </article>
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                  <span>Overall availability</span>
                  <span>{onlinePercent}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all"
                    style={{ width: `${onlinePercent}%` }}
                  />
                </div>
              </div>
            </>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold text-blue-50">Project Checks</h2>
          <p className="mt-1 text-sm text-slate-400">Status is based on the project URL from repository homepage or GitHub Pages fallback</p>

          {!loading && !error && data && data.projects.length === 0 && (
            <p className="mt-4 text-sm text-slate-400">No repositories found.</p>
          )}

          {!loading && !error && data && data.projects.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {data.projects.map((project) => {
                const statusColor =
                  project.status === "online"
                    ? "border-emerald-900/60 bg-emerald-950/20"
                    : project.status === "offline"
                    ? "border-rose-900/60 bg-rose-950/20"
                    : "border-amber-900/60 bg-amber-950/20";

                return (
                  <article key={project.id} className={`rounded-xl border p-4 ${statusColor}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <a
                          href={project.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-blue-200 underline decoration-blue-700 underline-offset-4"
                        >
                          {project.name}
                        </a>
                        <p className="mt-1 text-xs text-slate-400">{formatStatusLabel(project.status)}</p>
                      </div>

                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          project.status === "online"
                            ? "bg-emerald-500/20 text-emerald-200"
                            : project.status === "offline"
                            ? "bg-rose-500/20 text-rose-200"
                            : "bg-amber-500/20 text-amber-200"
                        }`}
                      >
                        {formatStatusLabel(project.status)}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-slate-400">
                      <p>
                        URL: {project.projectUrl ? (
                          <a
                            href={project.projectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-300 underline decoration-cyan-700 underline-offset-4"
                          >
                            {project.projectUrl}
                          </a>
                        ) : "-"}
                      </p>
                      <p>HTTP status: {project.statusCode ?? "-"}</p>
                      <p>Response time: {project.responseTimeMs ? `${project.responseTimeMs} ms` : "-"}</p>
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
