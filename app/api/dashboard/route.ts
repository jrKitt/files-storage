import { NextResponse } from "next/server";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getExistingBucket } from "@/lib/firebase-admin";
import { validateSession } from "@/lib/authStorage";

export const runtime = "nodejs";

type FirebaseState = "online" | "offline";
type StorageSource = "firebase" | "local";

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
    let totalFiles = 0;
    let usedBytes = 0;
    let firebaseStatus: FirebaseState = "offline";
    let storageSource: StorageSource = "local";

    try {
      const bucket = await getExistingBucket();
      const [files] = await bucket.getFiles({ prefix: "uploads/" });

      const objectFiles = files.filter((file) => !file.name.endsWith("/"));
      totalFiles = objectFiles.length;

      const metadatas = await Promise.all(
        objectFiles.map(async (file) => {
          const [metadata] = await file.getMetadata();
          return Number(metadata.size || 0);
        })
      );

      usedBytes = metadatas.reduce((acc, size) => acc + size, 0);
      firebaseStatus = "online";
      storageSource = "firebase";
    } catch {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadsDir, { recursive: true });
      const entries = await readdir(uploadsDir);

      const fileStats = await Promise.all(
        entries.map(async (fileName) => {
          const filePath = path.join(uploadsDir, fileName);
          return stat(filePath);
        })
      );

      totalFiles = fileStats.length;
      usedBytes = fileStats.reduce((acc, fileStat) => acc + fileStat.size, 0);
      firebaseStatus = "offline";
      storageSource = "local";
    }

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
