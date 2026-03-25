import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getStorage } from "firebase-admin/storage";

function getPrivateKey(): string {
  const raw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!raw) {
    throw new Error("Missing FIREBASE_ADMIN_PRIVATE_KEY");
  }

  return raw
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n")
    .trim();
}

function getClientEmail(): string {
  return (
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    "firebase-adminsdk-fbsvc@jrkitt.iam.gserviceaccount.com"
  );
}

function getProjectId(): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  }
  return projectId;
}

function getStorageBucket(): string {
  const bucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`
      : undefined);
  if (!bucket) {
    throw new Error("Missing FIREBASE_STORAGE_BUCKET");
  }
  return bucket;
}

function getDatabaseUrlCandidates(): string[] {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const region = process.env.FIREBASE_DATABASE_REGION || "asia-southeast1";

  const candidates = [
    process.env.FIREBASE_DATABASE_URL,
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId ? `https://${projectId}-default-rtdb.${region}.firebasedatabase.app` : undefined,
    projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined,
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
}

function getDatabaseUrl(): string {
  const [first] = getDatabaseUrlCandidates();
  if (!first) {
    throw new Error("Missing FIREBASE_DATABASE_URL or NEXT_PUBLIC_FIREBASE_DATABASE_URL");
  }
  return first;
}

function getBucketCandidates(): string[] {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  const candidates = [
    process.env.FIREBASE_STORAGE_BUCKET,
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    projectId ? `${projectId}.appspot.com` : undefined,
    projectId ? `${projectId}.firebasestorage.app` : undefined,
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
}

const app =
  getApps()[0] ||
  initializeApp({
    credential: cert({
      projectId: getProjectId(),
      clientEmail: getClientEmail(),
      privateKey: getPrivateKey(),
    }),
    storageBucket: getStorageBucket(),
    databaseURL: getDatabaseUrl(),
  });

export const adminStorage = getStorage(app);

export function getAdminDatabase() {
  return getDatabase(app);
}

export async function getExistingBucket() {
  const candidates = getBucketCandidates();
  if (candidates.length === 0) {
    throw new Error("No storage bucket candidates configured");
  }

  for (const bucketName of candidates) {
    try {
      const candidate = adminStorage.bucket(bucketName);
      const [exists] = await candidate.exists();
      if (exists) {
        return candidate;
      }
    } catch {
      // Try next candidate.
    }
  }

  throw new Error(
    `No existing Storage bucket found from candidates: ${candidates.join(", ")}. ` +
      "Enable Firebase Storage in Firebase Console and set FIREBASE_STORAGE_BUCKET to that bucket name."
  );
}
