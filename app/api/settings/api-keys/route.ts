import { NextResponse } from "next/server";
import { assertAuthorized } from "@/lib/accessControl";
import { addApiKey, deleteApiKey, listApiKeys } from "@/lib/systemSettingsStorage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await assertAuthorized(request, ["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const items = await listApiKeys();
    return NextResponse.json(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await assertAuthorized(request, ["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      name?: string;
      provider?: string;
      value?: string;
    };

    const created = await addApiKey({
      name: body.name || "",
      provider: body.provider || "custom",
      value: body.value || "",
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await assertAuthorized(request, ["admin"]);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await deleteApiKey(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
