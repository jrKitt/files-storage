import { NextResponse } from "next/server";
import { getAdminDatabase } from "@/lib/firebase-admin";
import { assertAuthorized } from "@/lib/accessControl";
import { encryptFileBuffer } from "@/lib/fileEncryption";

export const runtime = "nodejs";

function normalizeUploadFileName(value: string): string {
  const normalized = value.normalize("NFC").trim();
  if (!normalized) {
    throw new Error("Invalid file name");
  }

  if (normalized.includes("/") || normalized.includes("\\") || normalized.includes("..")) {
    throw new Error("Invalid file name");
  }

  const withoutControls = normalized.replace(/[\u0000-\u001F\u007F]/g, "");
  if (!withoutControls) {
    throw new Error("Invalid file name");
  }

  return withoutControls;
}

function getFileKey(fileName: string): string {
  return Buffer.from(fileName, "utf8").toString("base64url");
}

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
    const sanitizedName = normalizeUploadFileName(customName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const encryptedBuffer = encryptFileBuffer(buffer);

    const fileKey = getFileKey(sanitizedName);
    const db = getAdminDatabase();
    await db.ref(`encryptedFiles/${fileKey}`).set({
      name: sanitizedName,
      encryptedData: encryptedBuffer.toString("base64"),
      size: file.size,
      encryptedSize: encryptedBuffer.length,
      contentType: file.type || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
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
