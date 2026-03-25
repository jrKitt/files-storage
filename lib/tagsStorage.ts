import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

interface FileTags {
  [fileId: string]: string[]; // fileId -> tagIds
}

interface TagsData {
  tags: Tag[];
  fileTags: FileTags;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const TAGS_FILE = path.join(DATA_DIR, "tags.json");

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readTagsData(): Promise<TagsData> {
  try {
    await ensureDataDir();
    const content = await readFile(TAGS_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return { tags: [], fileTags: {} };
  }
}

async function writeTagsData(data: TagsData): Promise<void> {
  await ensureDataDir();
  await writeFile(TAGS_FILE, JSON.stringify(data, null, 2));
}

export async function getAllTags(): Promise<Tag[]> {
  const data = await readTagsData();
  return data.tags;
}

export async function createTag(name: string, color: string = "#3B82F6"): Promise<Tag> {
  const data = await readTagsData();
  const id = `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const tag: Tag = {
    id,
    name,
    color,
    createdAt: new Date().toISOString(),
  };
  
  data.tags.push(tag);
  await writeTagsData(data);
  return tag;
}

export async function deleteTag(tagId: string): Promise<void> {
  const data = await readTagsData();
  
  // Remove tag from tags list
  data.tags = data.tags.filter(t => t.id !== tagId);
  
  // Remove tag from all files
  Object.keys(data.fileTags).forEach(fileId => {
    data.fileTags[fileId] = data.fileTags[fileId].filter(id => id !== tagId);
  });
  
  await writeTagsData(data);
}

export async function getTagById(tagId: string): Promise<Tag | undefined> {
  const data = await readTagsData();
  return data.tags.find(t => t.id === tagId);
}

export async function getTagsForFile(fileId: string): Promise<Tag[]> {
  const data = await readTagsData();
  const tagIds = data.fileTags[fileId] || [];
  return data.tags.filter(t => tagIds.includes(t.id));
}

export async function assignTagToFile(fileId: string, tagId: string): Promise<void> {
  const data = await readTagsData();
  
  // Check if tag exists
  if (!data.tags.some(t => t.id === tagId)) {
    throw new Error("Tag not found");
  }
  
  if (!data.fileTags[fileId]) {
    data.fileTags[fileId] = [];
  }
  
  // Avoid duplicates
  if (!data.fileTags[fileId].includes(tagId)) {
    data.fileTags[fileId].push(tagId);
  }
  
  await writeTagsData(data);
}

export async function removeTagFromFile(fileId: string, tagId: string): Promise<void> {
  const data = await readTagsData();
  
  if (data.fileTags[fileId]) {
    data.fileTags[fileId] = data.fileTags[fileId].filter(id => id !== tagId);
  }
  
  await writeTagsData(data);
}

export async function getFilesWithTag(tagId: string): Promise<string[]> {
  const data = await readTagsData();
  return Object.keys(data.fileTags).filter(fileId => 
    data.fileTags[fileId].includes(tagId)
  );
}

export async function clearFileTagsOnDelete(fileId: string): Promise<void> {
  const data = await readTagsData();
  delete data.fileTags[fileId];
  await writeTagsData(data);
}
