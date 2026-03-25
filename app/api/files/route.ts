import { NextResponse } from "next/server";
import { getExistingBucket } from "@/lib/firebase-admin";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
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
    let filesList: Array<{
      name: string;
      size: number;
      uploadedAt: string;
      url: string;
      tags?: Array<{ id: string; name: string; color: string }>;
    }> = [];

    try {
      const bucket = await getExistingBucket();
      const [files] = await bucket.getFiles({ prefix: "uploads/" });

      filesList = await Promise.all(
        files
          .filter((file) => !file.name.endsWith("/"))
          .map(async (file) => {
            const [metadata] = await file.getMetadata();

            const fileName = file.name.replace("uploads/", "");
            const tags = await getTagsForFile(fileName);

            return {
              name: fileName,
              size: Number(metadata.size || 0),
              uploadedAt: metadata.timeCreated
                ? new Date(metadata.timeCreated).toLocaleString("en-US")
                : "Unknown date",
              url: `/api/files/download?name=${encodeURIComponent(fileName)}`,
              tags,
            };
          })
      );
    } catch {
      // Fallback: list files from /tmp runtime storage.
      const uploadsDir = path.join("/tmp", "jrkitt_uploads");
      await mkdir(uploadsDir, { recursive: true });

      const entries = await readdir(uploadsDir);
      filesList = await Promise.all(
        entries.map(async (fileName) => {
          const filePath = path.join(uploadsDir, fileName);
          const fileStat = await stat(filePath);
          const tags = await getTagsForFile(fileName);

          return {
            name: fileName,
            size: fileStat.size,
            uploadedAt: new Date(fileStat.mtime).toLocaleString("en-US"),
            url: `/api/files/download?name=${encodeURIComponent(fileName)}`,
            tags,
          };
        })
      );

      filesList.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
    }

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
