"use client";

import { useState, useEffect } from "react";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import TopNavbar from "./components/TopNavbar";
import FileUploader from "./components/FileUploader";
import TagsPanel from "./components/TagsPanel";
import SettingsPanel from "./components/SettingsPanel";
import GitHubManagement from "./components/GitHubManagement";
import GitHubStatusDashboard from "./components/GitHubStatusDashboard";
import { addTransactionNotification } from "@/lib/transactionNotifications";

interface Tag {
  id: string;
  name: string;
  color: string;
}

type UserRole = "admin" | "editor" | "viewer";

interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
}

type MenuKey = "storage" | "tags" | "settings" | "github" | "github-status";

export default function Home() {
  const [token, setToken] = useState<string>("");
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<MenuKey>("storage");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const userRole: UserRole = sessionUser?.role || "admin";
  const canManageTags = userRole === "admin" || userRole === "editor";
  const canAccessSettings = userRole === "admin";
  const canAccessGitHub = userRole === "admin" || userRole === "editor";
  const canAccessGitHubStatus = userRole === "admin";

  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token");
    if (storedToken) {
      validateAndSetToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const validateAndSetToken = async (authToken: string) => {
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": authToken,
        },
        body: JSON.stringify({ action: "validate" }),
      });

      const data = await response.json();
      if (data.valid) {
        setToken(authToken);
        const user = (data.user || null) as SessionUser | null;
        const role: UserRole = user?.role || "admin";
        setSessionUser(user);

        if (role === "admin" || role === "editor") {
          await loadTags(authToken);
        } else {
          setTags([]);
          setSelectedTag(null);
        }
      } else {
        localStorage.removeItem("auth_token");
      }
    } catch (err) {
      console.error("Error validating token:", err);
      localStorage.removeItem("auth_token");
    } finally {
      setIsLoading(false);
    }
  };

  const loadTags = async (authToken: string) => {
    try {
      const response = await fetch("/api/tags", {
        headers: { "x-auth-token": authToken },
      });

      if (response.ok) {
        const loadedTags: Tag[] = await response.json();
        setTags(loadedTags);
      }
    } catch (err) {
      console.error("Error loading tags:", err);
    }
  };

  const handleLoginSuccess = (authToken: string) => {
    void validateAndSetToken(authToken);
  };

  const handleCreateTag = async (name: string, color: string) => {
    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token,
        },
        body: JSON.stringify({ name, color }),
      });

      if (response.ok) {
        addTransactionNotification(`Created tag: ${name}`);
        await loadTags(token);
      }
    } catch (err) {
      console.error("Error creating tag:", err);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (
      confirm(
        "Are you sure you want to delete this tag? Files remain, but this tag will be removed from all files."
      )
    ) {
      try {
        const response = await fetch(`/api/tags?id=${encodeURIComponent(tagId)}`, {
          method: "DELETE",
          headers: { "x-auth-token": token },
        });

        if (response.ok) {
          const deletedTag = tags.find((item) => item.id === tagId);
          addTransactionNotification(
            `Deleted tag: ${deletedTag?.name || tagId}`
          );
          await loadTags(token);
          if (selectedTag === tagId) {
            setSelectedTag(null);
          }
        }
      } catch (err) {
        console.error("Error deleting tag:", err);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setToken("");
    setSessionUser(null);
    setTags([]);
    setSelectedTag(null);
  };

  useEffect(() => {
    const menuAllowed =
      activeMenu === "storage" ||
      (activeMenu === "tags" && canManageTags) ||
      (activeMenu === "settings" && canAccessSettings) ||
      (activeMenu === "github" && canAccessGitHub) ||
      (activeMenu === "github-status" && canAccessGitHubStatus);

    if (!menuAllowed) {
      setActiveMenu("storage");
    }
  }, [activeMenu, canManageTags, canAccessSettings, canAccessGitHub, canAccessGitHubStatus]);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [activeMenu]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-dvh bg-slate-950">
      <Sidebar
        activeMenu={activeMenu}
        onMenuChange={setActiveMenu}
        onLogout={handleLogout}
        userRole={userRole}
        mobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar
          username={sessionUser?.username || "user"}
          displayName={sessionUser?.displayName}
          onToggleSidebar={() => setIsMobileSidebarOpen(true)}
        />

        <div className="min-h-0 flex-1">
          {activeMenu === "storage" && (
            <FileUploader
              token={token}
              role={userRole}
              allTags={tags}
              selectedTag={selectedTag}
            />
          )}

          {activeMenu === "tags" && canManageTags && (
            <TagsPanel
              tags={tags}
              canManageTags={canManageTags}
              selectedTag={selectedTag}
              onTagSelect={setSelectedTag}
              onTagCreate={handleCreateTag}
              onTagDelete={handleDeleteTag}
            />
          )}

          {activeMenu === "settings" && canAccessSettings && <SettingsPanel token={token} />}

          {activeMenu === "github" && canAccessGitHub && <GitHubManagement token={token} canEdit={canAccessGitHub} />}

          {activeMenu === "github-status" && canAccessGitHubStatus && (
            <GitHubStatusDashboard token={token} />
          )}
        </div>
      </div>
    </div>
  );
}
