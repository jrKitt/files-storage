import { NextResponse } from "next/server";
import { getAdminDatabase } from "@/lib/firebase-admin";
import { decryptFileBuffer } from "@/lib/fileEncryption";
import { validateSession } from "@/lib/authStorage";

export const runtime = "nodejs";

function sanitizeName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    throw new Error("Invalid file name");
  }
  return trimmed;
}

function getFileKey(fileName: string): string {
  return Buffer.from(fileName, "utf8").toString("base64url");
}

export async function GET(request: Request) {
  const token = request.headers.get("x-auth-token") || "";
  const isValid = await validateSession(token);

  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const nameParam = url.searchParams.get("name") || "";
    const fileName = sanitizeName(nameParam);

    type StoredFileRecord = {
      name?: string;
      encryptedData?: string;
      contentType?: string;
    };

    const db = getAdminDatabase();
    const fileKey = getFileKey(fileName);
    const snapshot = await db.ref(`encryptedFiles/${fileKey}`).get();
    const record = snapshot.val() as StoredFileRecord | null;

    if (!record?.encryptedData) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const encryptedBytes = Buffer.from(record.encryptedData, "base64");

    const plainBytes = decryptFileBuffer(encryptedBytes);
    const contentTypeRaw = record.contentType || "application/octet-stream";
    const contentType =
      typeof contentTypeRaw === "string" ? contentTypeRaw : "application/octet-stream";
    const fallbackFileName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(new Uint8Array(plainBytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
