import { NextResponse } from "next/server";
import { getAllTags, createTag, deleteTag } from "@/lib/tagsStorage";
import { assertAuthorized } from "@/lib/accessControl";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await assertAuthorized(request);
    if (!auth.ok) {
      return auth.response;
    }

    const tags = await getAllTags();
    return NextResponse.json(tags);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Get tags API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await assertAuthorized(request, ["admin", "editor"]);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();
    const { name, color } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    const tag = await createTag(name, color || "#3B82F6");
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Create tag API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await assertAuthorized(request, ["admin", "editor"]);
    if (!auth.ok) {
      return auth.response;
    }

    const url = new URL(request.url);
    const tagId = url.searchParams.get("id");

    if (!tagId) {
      return NextResponse.json(
        { error: "Tag ID is required" },
        { status: 400 }
      );
    }

    await deleteTag(tagId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Delete tag API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
