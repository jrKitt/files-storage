"use client";

type MenuKey = "storage" | "tags" | "settings" | "github";
type UserRole = "admin" | "editor" | "viewer";

interface SidebarProps {
  activeMenu: MenuKey;
  onMenuChange: (menu: MenuKey) => void;
  onLogout: () => void;
  userRole: UserRole;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({
  activeMenu,
  onMenuChange,
  onLogout,
  userRole,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const menus: Array<{ key: MenuKey; label: string; description: string }> = [
    { key: "storage", label: "Storage", description: "File dashboard + download" },
    ...(userRole === "admin" || userRole === "editor"
      ? [{ key: "tags" as const, label: "Tags", description: "Tag management" }]
      : []),
    ...(userRole === "admin"
      ? [{ key: "settings" as const, label: "Settings", description: "Users, API keys, security" }]
      : []),
    ...(userRole === "admin" || userRole === "editor"
      ? [{ key: "github" as const, label: "GitHub", description: "jrkitt repositories" }]
      : []),
  ];

  const handleMenuClick = (menu: MenuKey) => {
    onMenuChange(menu);
    onCloseMobile();
  };

  const sidebarContent = (
    <>
      <div className="border-b border-slate-800 p-5">
        <h2 className="mb-1 text-xl font-semibold text-blue-100">jrKitt WS</h2>
        <p className="text-xs tracking-wide text-slate-400">Workspace Version 1.0</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 h-full">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Main Menu</p>
        <div className="space-y-2">
          {menus.map((menu) => {
            const active = activeMenu === menu.key;
            return (
              <button
                key={menu.key}
                type="button"
                onClick={() => handleMenuClick(menu.key)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  active
                    ? "border-blue-500 bg-blue-600/20 text-blue-100"
                    : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <p className="text-sm font-medium">{menu.label}</p>
                <p className="text-xs text-slate-400">{menu.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-800 p-4">
        <button
          onClick={onLogout}
          className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
        >
          Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden h-dvh w-64 flex-col border-r border-slate-800 bg-slate-950 lg:w-72 md:flex">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            onClick={onCloseMobile}
            className="absolute inset-0 bg-black/50"
            aria-label="Close sidebar"
          />
          <aside className="relative z-10 flex h-dvh w-[84vw] max-w-[320px] flex-col border-r border-slate-800 bg-slate-950">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
