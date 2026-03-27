import { NextResponse } from "next/server";
import { assertAuthorized } from "@/lib/accessControl";

export const runtime = "nodejs";

interface GitHubRepo {
  id: number;
  name: string;
  html_url: string;
  homepage: string | null;
  private: boolean;
  archived: boolean;
  disabled: boolean;
  fork: boolean;
  updated_at: string;
}

type ProjectStatus = "online" | "offline" | "unknown";

interface ProjectStatusItem {
  id: number;
  name: string;
  repoUrl: string;
  projectUrl: string | null;
  status: ProjectStatus;
  statusCode?: number;
  responseTimeMs?: number;
  updatedAt: string;
}

function withTimeout(signalTimeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), signalTimeoutMs);
  return controller.signal;
}

async function probeUrl(url: string): Promise<{
  status: ProjectStatus;
  statusCode?: number;
  responseTimeMs?: number;
}> {
  const start = Date.now();

  try {
    const headResponse = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: withTimeout(6000),
    });

    const elapsed = Date.now() - start;

    if (headResponse.ok || (headResponse.status >= 300 && headResponse.status < 400)) {
      return {
        status: "online",
        statusCode: headResponse.status,
        responseTimeMs: elapsed,
      };
    }

    if (headResponse.status !== 405) {
      return {
        status: "offline",
        statusCode: headResponse.status,
        responseTimeMs: elapsed,
      };
    }
  } catch {
    return { status: "offline" };
  }

  try {
    const getStart = Date.now();
    const getResponse = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: withTimeout(6000),
    });

    const elapsed = Date.now() - getStart;

    return {
      status: getResponse.ok ? "online" : "offline",
      statusCode: getResponse.status,
      responseTimeMs: elapsed,
    };
  } catch {
    return { status: "offline" };
  }
}

function toProjectUrl(owner: string, repo: GitHubRepo): string | null {
  const homepage = repo.homepage?.trim();
  if (homepage) {
    return homepage;
  }

  if (!repo.private && !repo.archived) {
    return `https://${owner}.github.io/${repo.name}/`;
  }

  return null;
}

export async function GET(request: Request) {
  const auth = await assertAuthorized(request, ["admin"]);
  if (!auth.ok) {
    return auth.response;
  }

  const owner = "jrkitt";
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "jrkitt-ws",
  };

  try {
    const reposResponse = await fetch(
      `https://api.github.com/users/${encodeURIComponent(owner)}/repos?sort=updated&per_page=30`,
      {
        method: "GET",
        headers,
      }
    );

    if (!reposResponse.ok) {
      return NextResponse.json(
        { error: `GitHub API failed with status ${reposResponse.status}` },
        { status: 502 }
      );
    }

    const repos = (await reposResponse.json()) as GitHubRepo[];

    const projects: ProjectStatusItem[] = await Promise.all(
      repos.map(async (repo) => {
        const projectUrl = toProjectUrl(owner, repo);

        if (!projectUrl) {
          return {
            id: repo.id,
            name: repo.name,
            repoUrl: repo.html_url,
            projectUrl: null,
            status: "unknown",
            updatedAt: repo.updated_at,
          } satisfies ProjectStatusItem;
        }

        const probe = await probeUrl(projectUrl);

        return {
          id: repo.id,
          name: repo.name,
          repoUrl: repo.html_url,
          projectUrl,
          status: probe.status,
          statusCode: probe.statusCode,
          responseTimeMs: probe.responseTimeMs,
          updatedAt: repo.updated_at,
        } satisfies ProjectStatusItem;
      })
    );

    const onlineCount = projects.filter((project) => project.status === "online").length;
    const offlineCount = projects.filter((project) => project.status === "offline").length;
    const unknownCount = projects.filter((project) => project.status === "unknown").length;

    return NextResponse.json({
      owner,
      checkedAt: new Date().toISOString(),
      total: projects.length,
      onlineCount,
      offlineCount,
      unknownCount,
      projects,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
