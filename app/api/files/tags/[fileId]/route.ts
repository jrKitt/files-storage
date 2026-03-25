import { NextResponse } from "next/server";
import {
  getTagsForFile,
  assignTagToFile,
  removeTagFromFile,
} from "@/lib/tagsStorage";
import { assertAuthorized } from "@/lib/accessControl";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  props: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await props.params;
    const auth = await assertAuthorized(request);
    if (!auth.ok) {
      return auth.response;
    }

    const tags = await getTagsForFile(decodeURIComponent(fileId));
    return NextResponse.json(tags);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Get file tags API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await props.params;
    const auth = await assertAuthorized(request, ["admin", "editor"]);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();
    const { tagId } = body;

    if (!tagId) {
      return NextResponse.json(
        { error: "Tag ID is required" },
        { status: 400 }
      );
    }

    await assignTagToFile(decodeURIComponent(fileId), tagId);
    const tags = await getTagsForFile(decodeURIComponent(fileId));
    return NextResponse.json(tags, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Assign tag API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await props.params;
    const auth = await assertAuthorized(request, ["admin", "editor"]);
    if (!auth.ok) {
      return auth.response;
    }

    const url = new URL(request.url);
    const tagId = url.searchParams.get("tagId");

    if (!tagId) {
      return NextResponse.json(
        { error: "Tag ID is required" },
        { status: 400 }
      );
    }

    await removeTagFromFile(decodeURIComponent(fileId), tagId);
    const tags = await getTagsForFile(decodeURIComponent(fileId));
    return NextResponse.json(tags);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Remove tag API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
