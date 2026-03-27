import { NextResponse } from "next/server";
import { getAdminDatabase } from "@/lib/firebase-admin";
import { getTagsForFile, getFilesWithTag } from "@/lib/tagsStorage";
import { validateSession } from "@/lib/authStorage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = request.headers.get("x-auth-token") || "";
  const isValid = await validateSession(token);

  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tagFilter = url.searchParams.get("tag");

  try {
    type StoredFileRecord = {
      name?: string;
      size?: number;
      encryptedSize?: number;
      contentType?: string;
      uploadedAt?: string;
      encryptedData?: string;
    };

    let filesList: Array<{
      name: string;
      size: number;
      uploadedAt: string;
      url: string;
      tags?: Array<{ id: string; name: string; color: string }>;
    }> = [];

    const db = getAdminDatabase();
    const snapshot = await db.ref("encryptedFiles").get();
    const records = (snapshot.val() || {}) as Record<string, StoredFileRecord>;
    const entries = Object.values(records);

    filesList = await Promise.all(
      entries
        .filter((record) => typeof record.name === "string" && Boolean(record.name?.trim()))
        .map(async (record) => {
          const fileName = record.name as string;
          const tags = await getTagsForFile(fileName);

          return {
            name: fileName,
            size: Number(record.size || 0),
            uploadedAt: record.uploadedAt
              ? new Date(record.uploadedAt).toLocaleString("en-US")
              : "Unknown date",
            url: `/api/files/download?name=${encodeURIComponent(fileName)}`,
            tags,
          };
        })
    );

    filesList.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));

    // Filter by tag if specified
    if (tagFilter) {
      const filesWithTag = await getFilesWithTag(tagFilter);
      filesList = filesList.filter((file) => filesWithTag.includes(file.name));
    }

    return NextResponse.json(filesList);
  } catch (error) {
    console.error("Error listing files:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to list files", details: errorMessage },
      { status: 500 }
    );
  }
}
