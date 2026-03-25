"use client";

import { useState } from "react";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagsPanelProps {
  tags: Tag[];
  canManageTags: boolean;
  selectedTag: string | null;
  onTagSelect: (tagId: string | null) => void;
  onTagCreate: (name: string, color: string) => Promise<void>;
  onTagDelete: (tagId: string) => Promise<void>;
}

const COLORS = [
  "#3B82F6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
];

export default function TagsPanel({
  tags,
  canManageTags,
  selectedTag,
  onTagSelect,
  onTagCreate,
  onTagDelete,
}: TagsPanelProps) {
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTagName.trim()) return;

    setIsCreating(true);
    try {
      await onTagCreate(newTagName.trim(), selectedColor);
      setNewTagName("");
      setSelectedColor(COLORS[0]);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-slate-950 px-6 py-6 md:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h1 className="text-2xl font-semibold text-blue-50">Tag Management</h1>
          <p className="mt-1 text-sm text-slate-400">Manage all tags for filtering and file classification</p>

          <form onSubmit={handleCreate} className="mt-6 space-y-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <input
              type="text"
              value={newTagName}
              onChange={(event) => setNewTagName(event.target.value)}
              placeholder="New tag name"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              disabled={!canManageTags}
            />

            <div className="grid grid-cols-8 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`h-8 rounded-md ${selectedColor === color ? "ring-2 ring-white" : ""}`}
                  style={{ backgroundColor: color }}
                  aria-label={`color-${color}`}
                  disabled={!canManageTags}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={!canManageTags || isCreating || !newTagName.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:bg-slate-700"
            >
              {isCreating ? "Creating..." : "Create tag"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-blue-50">Tag List</h2>
            <button
              type="button"
              onClick={() => onTagSelect(null)}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              Clear filter
            </button>
          </div>

          {tags.length === 0 ? (
            <p className="text-sm text-slate-400">No tags available</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {tags.map((tag) => {
                const isActive = selectedTag === tag.id;
                return (
                  <article
                    key={tag.id}
                    className={`rounded-xl border p-4 ${
                      isActive ? "border-blue-600 bg-slate-800" : "border-slate-800 bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onTagSelect(isActive ? null : tag.id)}
                        className="flex min-w-0 items-center gap-2 text-left"
                      >
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span className="truncate text-sm font-medium text-blue-100">{tag.name}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onTagDelete(tag.id)}
                        disabled={!canManageTags}
                        className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-red-500 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
