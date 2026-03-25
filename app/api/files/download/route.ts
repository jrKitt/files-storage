import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getExistingBucket } from "@/lib/firebase-admin";
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

    try {
      const bucket = await getExistingBucket();
      const object = bucket.file(`uploads/${fileName}`);
      const [exists] = await object.exists();
      if (exists) {
        const [encryptedBytes, metadata] = await Promise.all([
          object.download().then((result) => result[0]),
          object.getMetadata().then((result) => result[0]),
        ]);

        const plainBytes = decryptFileBuffer(encryptedBytes);
        const contentTypeRaw =
          metadata.metadata?.originalContentType ||
          metadata.contentType ||
          "application/octet-stream";
        const contentType =
          typeof contentTypeRaw === "string" ? contentTypeRaw : "application/octet-stream";

        return new NextResponse(new Uint8Array(plainBytes), {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Cache-Control": "no-store",
          },
        });
      }
    } catch {
      // Try local fallback.
    }

    const candidates = [
      path.join("/tmp", "jrkitt_uploads", fileName),
      path.join(process.cwd(), "public", "uploads", fileName),
    ];

    for (const candidate of candidates) {
      try {
        const encryptedBytes = await readFile(candidate);
        const plainBytes = decryptFileBuffer(encryptedBytes);
        return new NextResponse(new Uint8Array(plainBytes), {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Cache-Control": "no-store",
          },
        });
      } catch {
        // Continue fallback chain.
      }
    }

    return NextResponse.json({ error: "File not found" }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
