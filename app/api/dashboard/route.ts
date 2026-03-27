import { NextResponse } from "next/server";
import { getExistingBucket } from "@/lib/firebase-admin";
import { validateSession } from "@/lib/authStorage";

export const runtime = "nodejs";

type FirebaseState = "online" | "offline";
type StorageSource = "firebase";

interface DashboardResponse {
  totalFiles: number;
  usedBytes: number;
  recommendedBytes: number;
  usagePercent: number;
  firebaseStatus: FirebaseState;
  storageSource: StorageSource;
}

const DEFAULT_RECOMMENDED_GB = 5;

export async function GET(request: Request) {
  const token = request.headers.get("x-auth-token") || "";
  const isValid = await validateSession(token);

  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recommendedGb = Number(
    process.env.STORAGE_RECOMMENDED_LIMIT_GB || DEFAULT_RECOMMENDED_GB
  );
  const recommendedBytes = Math.max(1, recommendedGb) * 1024 * 1024 * 1024;

  try {
    const bucket = await getExistingBucket();
    const [files] = await bucket.getFiles({ prefix: "uploads/" });

    const objectFiles = files.filter((file) => !file.name.endsWith("/"));
    const totalFiles = objectFiles.length;

    const metadatas = await Promise.all(
      objectFiles.map(async (file) => {
        const [metadata] = await file.getMetadata();
        return Number(metadata.size || 0);
      })
    );

    const usedBytes = metadatas.reduce((acc, size) => acc + size, 0);
    const firebaseStatus: FirebaseState = "online";
    const storageSource: StorageSource = "firebase";

    const usagePercent = Math.min(100, (usedBytes / recommendedBytes) * 100);

    const payload: DashboardResponse = {
      totalFiles,
      usedBytes,
      recommendedBytes,
      usagePercent,
      firebaseStatus,
      storageSource,
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
