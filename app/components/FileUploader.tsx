"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { addTransactionNotification } from "@/lib/transactionNotifications";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface UploadedFile {
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
  tags?: Tag[];
}

interface DashboardData {
  totalFiles: number;
  usedBytes: number;
  recommendedBytes: number;
  usagePercent: number;
  firebaseStatus: "online" | "offline";
  storageSource: "firebase" | "local";
}

interface FileUploaderProps {
  token: string;
  role: "admin" | "editor" | "viewer";
  allTags: Tag[];
  selectedTag: string | null;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
};

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function FileUploader({ token, role, allTags, selectedTag }: FileUploaderProps) {
  const canEdit = role === "admin" || role === "editor";
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [customNames, setCustomNames] = useState<Record<number, string>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);
  const [tagMenuOpen, setTagMenuOpen] = useState<Record<string, boolean>>({});
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "-";
  const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "-";
  const firebaseBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "-";

  const loadUploadedFiles = async () => {
    try {
      setLoadingFiles(true);
      const url = selectedTag ? `/api/files?tag=${encodeURIComponent(selectedTag)}` : "/api/files";
      const response = await fetch(url, {
        headers: { "x-auth-token": token },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string; details?: string }
          | null;
        throw new Error(body?.details || body?.error || "Failed to load files");
      }

      const files = (await response.json()) as UploadedFile[];
      setUploadedFiles(files);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to load files");
      setIsError(true);
    } finally {
      setLoadingFiles(false);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoadingDashboard(true);
      const response = await fetch("/api/dashboard", {
        headers: { "x-auth-token": token },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to load dashboard");
      }

      const data = (await response.json()) as DashboardData;
      setDashboard(data);
    } catch {
      setDashboard(null);
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    void loadUploadedFiles();
  }, [selectedTag, token]);

  useEffect(() => {
    void loadDashboard();
  }, [token]);

  const queueFiles = (nextFiles: File[]) => {
    setQueuedFiles((prev) => [...prev, ...nextFiles]);
    setNotice("");
    setIsError(false);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dropZoneRef.current?.classList.add("ring-2", "ring-blue-400", "border-blue-400");
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dropZoneRef.current?.classList.remove("ring-2", "ring-blue-400", "border-blue-400");
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dropZoneRef.current?.classList.remove("ring-2", "ring-blue-400", "border-blue-400");
    queueFiles(Array.from(event.dataTransfer.files));
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      queueFiles(Array.from(event.target.files));
      event.target.value = "";
    }
  };

  const removeQueuedFile = (index: number) => {
    setQueuedFiles((prev) => prev.filter((_, i) => i !== index));
    setCustomNames((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (queuedFiles.length === 0) {
      setNotice("Please select files before uploading");
      setIsError(true);
      return;
    }

    setUploading(true);
    setNotice("");
    setIsError(false);

    try {
      let successCount = 0;

      for (let index = 0; index < queuedFiles.length; index += 1) {
        const file = queuedFiles[index];
        const fileName = customNames[index]?.trim() || file.name;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileName", fileName);

        setUploadProgress((prev) => ({ ...prev, [index]: 30 }));

        const response = await fetch("/api/upload", {
          method: "POST",
          headers: { "x-auth-token": token },
          body: formData,
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string; details?: string }
            | null;
          throw new Error(body?.details || body?.error || "Upload failed");
        }

        setUploadProgress((prev) => ({ ...prev, [index]: 100 }));
        successCount += 1;
      }

      setNotice(`Uploaded ${successCount} file(s) successfully`);
      addTransactionNotification(`Uploaded ${successCount} file(s)`);
      setQueuedFiles([]);
      setCustomNames({});
      setUploadProgress({});
      await Promise.all([loadUploadedFiles(), loadDashboard()]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unexpected upload error");
      setIsError(true);
    } finally {
      setUploading(false);
    }
  };

  const assignTagToFile = async (fileName: string, tagId: string) => {
    try {
      const response = await fetch(`/api/files/tags/${encodeURIComponent(fileName)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token,
        },
        body: JSON.stringify({ tagId }),
      });

      if (!response.ok) {
        throw new Error("Failed to assign tag");
      }

      const tagName = allTags.find((item) => item.id === tagId)?.name || tagId;
      addTransactionNotification(`Assigned tag ${tagName} to ${fileName}`);
      setTagMenuOpen({});
      await loadUploadedFiles();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to assign tag");
      setIsError(true);
    }
  };

  const removeTagFromFile = async (fileName: string, tagId: string) => {
    try {
      const response = await fetch(
        `/api/files/tags/${encodeURIComponent(fileName)}?tagId=${encodeURIComponent(tagId)}`,
        {
          method: "DELETE",
          headers: { "x-auth-token": token },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to remove tag");
      }

      const tagName = allTags.find((item) => item.id === tagId)?.name || tagId;
      addTransactionNotification(`Removed tag ${tagName} from ${fileName}`);
      await loadUploadedFiles();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to remove tag");
      setIsError(true);
    }
  };

  const downloadFile = async (file: UploadedFile) => {
    try {
      const response = await fetch(file.url, {
        headers: { "x-auth-token": token },
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string; details?: string }
          | null;
        throw new Error(body?.details || body?.error || "Failed to download file");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.name;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to download file");
      setIsError(true);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-slate-950 px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-blue-300/80">Storage Control</p>
              <h1 className="mt-1 text-2xl font-semibold text-blue-50 md:text-3xl">Storage Dashboard</h1>
              <p className="mt-1 text-sm text-slate-400">Server and Firebase specs on the left, transactions on the right</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void Promise.all([loadUploadedFiles(), loadDashboard()]);
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
            >
              Refresh
            </button>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Server Status</h2>
                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${dashboard?.firebaseStatus === "online" ? "bg-emerald-900/50 text-emerald-300" : "bg-amber-900/50 text-amber-300"}`}>
                  {loadingDashboard ? "CHECKING" : dashboard?.firebaseStatus === "online" ? "ONLINE" : "FALLBACK"}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Storage source</span>
                  <span className="font-medium text-slate-100">{dashboard?.storageSource === "firebase" ? "Firebase" : "Local fallback"}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Role</span>
                  <span className="font-medium text-slate-100 uppercase">{role}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Total files</span>
                  <span className="font-medium text-slate-100">{loadingDashboard ? "..." : dashboard?.totalFiles ?? 0}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Used storage</span>
                  <span className="font-medium text-slate-100">{loadingDashboard || !dashboard ? "..." : formatBytes(dashboard.usedBytes)}</span>
                </div>
                <div className="flex items-center justify-between pb-1">
                  <span className="text-slate-400">Recommended limit</span>
                  <span className="font-medium text-slate-100">{loadingDashboard || !dashboard ? "..." : formatBytes(dashboard.recommendedBytes)}</span>
                </div>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${dashboard?.usagePercent ?? 0}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {loadingDashboard || !dashboard ? "" : `Usage ${dashboard.usagePercent.toFixed(1)}%`}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">Firebase Database Spec</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Project ID</span>
                  <span className="max-w-[180px] truncate font-medium text-slate-100">{firebaseProjectId}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Auth domain</span>
                  <span className="max-w-[180px] truncate font-medium text-slate-100">{firebaseAuthDomain}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Storage bucket</span>
                  <span className="max-w-[180px] truncate font-medium text-slate-100">{firebaseBucket}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Database mode</span>
                  <span className="font-medium text-slate-100">Cloud object storage</span>
                </div>
              </div>
            </section>
          </aside>

          <div className="space-y-4">
            {notice && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  isError
                    ? "border-red-900/80 bg-red-950/40 text-red-200"
                    : "border-emerald-900/80 bg-emerald-950/40 text-emerald-200"
                }`}
              >
                {notice}
              </div>
            )}

            {canEdit && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold text-blue-50">Upload Center</h2>
          <p className="mt-1 text-sm text-slate-400">Drag files here or choose files to upload</p>

          <form onSubmit={handleUpload} className="mt-4 space-y-4">
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="rounded-xl border-2 border-dashed border-slate-700 bg-slate-900 p-8 text-center transition"
            >
              <label htmlFor="file-input" className="cursor-pointer">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-blue-300">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.7">
                    <path d="M12 16V7" strokeLinecap="round" />
                    <path d="M8.5 10.5L12 7l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4.5 16.5v1a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-sm text-blue-100">Click to browse or drop files here</p>
                <p className="mt-1 text-xs text-slate-400">Multiple files are supported</p>
              </label>
              <input id="file-input" type="file" multiple onChange={handleFileSelect} className="hidden" />
            </div>

            {queuedFiles.length > 0 && (
              <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
                {queuedFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-blue-50">{file.name}</p>
                        <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQueuedFile(index)}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-red-500 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Rename file (optional)"
                      value={customNames[index] || ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCustomNames((prev) => ({ ...prev, [index]: value }));
                      }}
                      className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-blue-50 outline-none transition focus:border-blue-500"
                    />
                    {uploading && (
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${uploadProgress[index] || 0}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || queuedFiles.length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {uploading ? "Uploading..." : "Start Upload"}
            </button>
          </form>
        </section>
            )}

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-blue-50">File Archive</h2>
            {selectedTag && <span className="text-xs text-slate-400">Filtered by selected tag</span>}
          </div>

          {loadingFiles ? (
            <p className="text-sm text-slate-400">Loading file list...</p>
          ) : uploadedFiles.length === 0 ? (
            <p className="text-sm text-slate-400">No files found</p>
          ) : (
            <div className="space-y-3">
              {uploadedFiles.map((file) => (
                <article
                  key={`${file.name}-${file.uploadedAt}`}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <button
                        type="button"
                        onClick={() => void downloadFile(file)}
                        className="text-left text-sm font-medium text-blue-200 underline decoration-blue-700 underline-offset-4 transition hover:text-blue-100"
                      >
                        {file.name}
                      </button>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatBytes(file.size)} | {formatDateTime(file.uploadedAt)}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setTagMenuOpen((prev) => ({
                              ...prev,
                              [file.name]: !prev[file.name],
                            }))
                          }
                          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 transition hover:bg-slate-700"
                        >
                          Manage Tags
                        </button>

                        {tagMenuOpen[file.name] && (
                          <div className="absolute right-0 z-10 mt-2 w-52 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-lg">
                            {allTags.length === 0 ? (
                              <p className="p-2 text-xs text-slate-400">No tags available</p>
                            ) : (
                              allTags.map((tag) => {
                                const assigned = file.tags?.some((item) => item.id === tag.id);
                                return (
                                  <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() =>
                                      assigned
                                        ? void removeTagFromFile(file.name, tag.id)
                                        : void assignTagToFile(file.name, tag.id)
                                    }
                                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800"
                                  >
                                    <span className="flex items-center gap-2">
                                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                                      {tag.name}
                                    </span>
                                    <span className={assigned ? "text-emerald-400" : "text-slate-500"}>
                                      {assigned ? "Attached" : "Attach"}
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {file.tags?.length ? (
                      file.tags.map((tag) => (
                        <span
                          key={`${file.name}-${tag.id}`}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-200"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => void removeTagFromFile(file.name, tag.id)}
                              className="text-slate-400 transition hover:text-red-300"
                              aria-label="remove tag"
                            >
                              x
                            </button>
                          )}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No tags assigned</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
          </div>
        </div>
      </div>
    </main>
  );
}
