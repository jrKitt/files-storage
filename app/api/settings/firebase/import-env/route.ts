import { NextResponse } from "next/server";
import { upsertApiKey } from "@/lib/systemSettingsStorage";
import { assertAuthorized } from "@/lib/accessControl";

export const runtime = "nodejs";

const FIREBASE_ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "FIREBASE_ADMIN_PRIVATE_KEY",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_STORAGE_BUCKET",
] as const;

export async function POST(request: Request) {
  const auth = await assertAuthorized(request, ["admin"]);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const imported: string[] = [];

    for (const envName of FIREBASE_ENV_KEYS) {
      const value = process.env[envName];
      if (!value || value.trim() === "") {
        continue;
      }

      await upsertApiKey({
        name: envName,
        provider: "firebase",
        value,
      });
      imported.push(envName);
    }

    return NextResponse.json({ success: true, imported });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
