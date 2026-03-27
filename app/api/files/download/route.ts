import { NextResponse } from "next/server";
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

    const bucket = await getExistingBucket();
    const object = bucket.file(`uploads/${fileName}`);
    const [exists] = await object.exists();
    if (!exists) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
