import { NextResponse } from "next/server";
import { getExistingBucket } from "@/lib/firebase-admin";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertAuthorized } from "@/lib/accessControl";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await assertAuthorized(request, ["admin", "editor"]);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const fileName = formData.get("fileName");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file" },
        { status: 400 }
      );
    }

    const customName = typeof fileName === "string" && fileName.trim() ? fileName : file.name;
    const sanitizedName = customName.replace(/[^a-zA-Z0-9._-]/g, "_");

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let url = "";

    try {
      const bucket = await getExistingBucket();
      const objectPath = `uploads/${sanitizedName}`;
      const object = bucket.file(objectPath);

      await object.save(buffer, {
        metadata: {
          contentType: file.type || "application/octet-stream",
        },
        resumable: false,
      });

      const [signedUrl] = await object.getSignedUrl({
        action: "read",
        version: "v4",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });

      url = signedUrl;
    } catch {
      // Fallback: save into local public/uploads when Firebase bucket is unavailable.
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadsDir, { recursive: true });

      const localFileName = `${Date.now()}_${sanitizedName}`;
      const localFilePath = path.join(uploadsDir, localFileName);

      await writeFile(localFilePath, buffer);
      url = `/uploads/${encodeURIComponent(localFileName)}`;
    }

    return NextResponse.json({
      success: true,
      name: sanitizedName,
      url,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Upload API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
