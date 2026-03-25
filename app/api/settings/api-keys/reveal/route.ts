import { NextResponse } from "next/server";
import { verifyPasswordForToken } from "@/lib/authStorage";
import { assertAuthorized } from "@/lib/accessControl";
import { revealApiKeyValue } from "@/lib/systemSettingsStorage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await assertAuthorized(request, ["admin"]);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      password?: string;
    };

    if (!body.id || !body.password) {
      return NextResponse.json({ error: "id and password are required" }, { status: 400 });
    }

    const passwordValid = await verifyPasswordForToken(auth.context.token, body.password);
    if (!passwordValid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 403 });
    }

    const value = await revealApiKeyValue(body.id);
    return NextResponse.json({ value });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
