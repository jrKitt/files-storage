import { NextResponse } from "next/server";
import { assertAuthorized } from "@/lib/accessControl";
import { getGitHubConfig, updateGitHubConfig } from "@/lib/systemSettingsStorage";

export const runtime = "nodejs";

interface GitHubRepo {
  id: number;
  name: string;
  html_url: string;
  private: boolean;
  description: string | null;
  updated_at: string;
  stargazers_count: number;
}

export async function GET(request: Request) {
  const auth = await assertAuthorized(request, ["admin", "editor"]);
  if (!auth.ok) return auth.response;

  try {
    const config = await getGitHubConfig();
    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
      "User-Agent": "jrkitt-ws",
    };

    if (config.personalAccessToken) {
      headers.Authorization = `Bearer ${config.personalAccessToken}`;
    }

    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(config.owner)}/repos?sort=updated&per_page=30`,
      {
        method: "GET",
        headers,
      }
    );

    const repos = response.ok ? ((await response.json()) as GitHubRepo[]) : [];
    const normalizedRepos = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      url: repo.html_url,
      private: repo.private,
      description: repo.description,
      updatedAt: repo.updated_at,
      stars: repo.stargazers_count,
    }));

    return NextResponse.json({
      owner: config.owner,
      repositories: normalizedRepos,
      pinnedRepositories: config.repositories,
      source: response.ok ? "github" : "local",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await assertAuthorized(request, ["admin", "editor"]);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      owner?: string;
      repositories?: string[];
      personalAccessToken?: string;
    };

    const next = await updateGitHubConfig({
      owner: body.owner,
      repositories: body.repositories,
      personalAccessToken: body.personalAccessToken,
    });

    return NextResponse.json({
      owner: next.owner,
      repositories: next.repositories,
      hasToken: Boolean(next.personalAccessToken),
      lastSyncAt: next.lastSyncAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
