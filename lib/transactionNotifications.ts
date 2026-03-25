export interface TransactionNotification {
  id: string;
  message: string;
  createdAt: string;
  expiresAt: string;
}

const STORAGE_KEY = "jrkitt.transaction.notifications";
const EXPIRY_MS = 5 * 60 * 1000;
const UPDATE_EVENT = "app:notifications-updated";

function readNotifications(): TransactionNotification[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as TransactionNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNotifications(items: TransactionNotification[]): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(UPDATE_EVENT));
}

export function purgeExpiredNotifications(): TransactionNotification[] {
  const now = Date.now();
  const next = readNotifications().filter((item) => {
    const expiry = new Date(item.expiresAt).getTime();
    return Number.isFinite(expiry) && expiry > now;
  });

  writeNotifications(next);
  return next;
}

export function getActiveNotifications(): TransactionNotification[] {
  const active = purgeExpiredNotifications();
  return active.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function addTransactionNotification(message: string): void {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRY_MS);

  const nextItem: TransactionNotification = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    message,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const existing = readNotifications();
  writeNotifications([nextItem, ...existing].slice(0, 100));
}

export function clearNotifications(): void {
  writeNotifications([]);
}

export const notificationUpdateEventName = UPDATE_EVENT;
