"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearNotifications,
  getActiveNotifications,
  notificationUpdateEventName,
  type TransactionNotification,
} from "@/lib/transactionNotifications";

interface TopNavbarProps {
  username: string;
  displayName?: string;
  onToggleSidebar: () => void;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Just now";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes === 1) return "1 minute ago";
  return `${diffMinutes} minutes ago`;
}

export default function TopNavbar({ username, displayName, onToggleSidebar }: TopNavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<TransactionNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initials = useMemo(() => {
    const source = (displayName || username || "U").trim();
    return source.slice(0, 1).toUpperCase();
  }, [displayName, username]);

  const refreshNotifications = () => {
    setNotifications(getActiveNotifications());
  };

  useEffect(() => {
    refreshNotifications();

    const interval = window.setInterval(() => {
      refreshNotifications();
    }, 15000);

    const onUpdated = () => refreshNotifications();
    const onClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener(notificationUpdateEventName, onUpdated);
    document.addEventListener("mousedown", onClickOutside);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener(notificationUpdateEventName, onUpdated);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 px-4 py-4 backdrop-blur md:px-8">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-200 hover:bg-slate-800 md:hidden"
            aria-label="Open sidebar menu"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16" strokeLinecap="round" />
              <path d="M4 12h16" strokeLinecap="round" />
              <path d="M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-sm text-slate-300">Hello, {displayName || username}</p>
          </div>
        </div>

        <div ref={dropdownRef} className="relative flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              refreshNotifications();
              setIsOpen((prev) => !prev);
            }}
            className="relative rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 hover:bg-slate-800"
            aria-label="Open notifications"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M12 4a5 5 0 0 0-5 5v2.8c0 .7-.2 1.4-.6 2L5 16h14l-1.4-2.2a3.8 3.8 0 0 1-.6-2V9a5 5 0 0 0-5-5Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 18a2 2 0 0 0 4 0" strokeLinecap="round" />
            </svg>
            {notifications.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {notifications.length > 99 ? "99+" : notifications.length}
              </span>
            )}
          </button>

          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-sm font-semibold text-blue-100">
            {initials}
          </div>

          {isOpen && (
            <div className="absolute right-0 top-12 z-20 w-[360px] rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                <p className="text-sm font-semibold text-blue-100">Notifications</p>
                <button
                  type="button"
                  onClick={() => clearNotifications()}
                  className="text-xs text-slate-300 hover:text-white"
                >
                  Clear all
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto p-2">
                {notifications.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-slate-400">No notifications</p>
                ) : (
                  notifications.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                    >
                      <p className="text-sm text-slate-100">{item.message}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatTime(item.createdAt)}</p>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
