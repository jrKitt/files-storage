import { NextResponse } from "next/server";
import { getExistingBucket } from "@/lib/firebase-admin";
import { assertAuthorized } from "@/lib/accessControl";
import { encryptFileBuffer } from "@/lib/fileEncryption";

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
    const encryptedBuffer = encryptFileBuffer(buffer);

    const bucket = await getExistingBucket();
    const objectPath = `uploads/${sanitizedName}`;
    const object = bucket.file(objectPath);

    await object.save(encryptedBuffer, {
      metadata: {
        contentType: "application/octet-stream",
        metadata: {
          encrypted: "1",
          originalContentType: file.type || "application/octet-stream",
        },
      },
      resumable: false,
    });

    const url = `/api/files/download?name=${encodeURIComponent(sanitizedName)}`;

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
