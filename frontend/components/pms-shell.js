"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { navItems, profileImage } from "./data";
import { ThemeToggle } from "./theme-toggle";
import DotGrid from "./DotGrid";

function NavLink({ item, active, collapsed }) {
  return (
    <Link
      href={item.href}
      className={[
        "group flex items-center rounded-lg px-3 py-2.5 text-sm transition-colors",
        collapsed ? "justify-center" : "gap-3",
        active
          ? "bg-primary/10 font-bold text-primary dark:bg-primary/15"
          : "font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80",
      ].join(" ")}
      title={collapsed ? item.label : undefined}
    >
      <span
        className="material-symbols-outlined text-xl group-hover:text-primary"
        style={active ? { fontVariationSettings: '"FILL" 1' } : undefined}
      >
        {item.icon}
      </span>
      {!collapsed ? <span>{item.label}</span> : null}
    </Link>
  );
}

export function PmsShell({
  searchPlaceholder,
  sidebarMetricLabel,
  sidebarMetricValue,
  sidebarMetricProgress,
  children,
}) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const normalizedPathname = pathname?.replace(/\/+$/, "") || "/";

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-transparent text-slate-900 dark:text-slate-100">
      <header className="theme-panel fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard/"
            className="flex items-center gap-3 text-primary"
          >
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/25">
              <span className="material-symbols-outlined">domain</span>
            </div>
            <h2 className="text-lg font-bold leading-tight tracking-tight">
              Hotel PMS
            </h2>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl text-slate-400">
              search
            </span>
            <input
              className="w-64 rounded-xl border border-slate-200 bg-white/70 py-2 pl-10 pr-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200"
              placeholder={searchPlaceholder}
              type="text"
            />
          </div>
          <ThemeToggle />
          <button className="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-red-500 dark:border-slate-900" />
          </button>
          <div className="mx-1 h-8 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold">Alex Rivers</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Manager
              </p>
            </div>
            <div className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 dark:border-primary/30 dark:bg-primary/15">
              <Image
                src={profileImage}
                alt="User Profile"
                width={36}
                height={36}
                className="size-full object-cover"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <DotGrid
          dotSize={2}
          gap={24}
          baseColor="#7f5757"
          activeColor="#ff2929"
          proximity={70}
          shockRadius={40}
          shockStrength={20}
          resistance={950}
          returnDuration={1.7}
        />
      </div>


      <div
        className="flex grow overflow-hidden pt-[73px] relative"
        style={{ zIndex: 1 }}
      >
        <aside
          className={[
            "theme-panel fixed left-0 top-[73px] z-30 hidden h-[calc(100vh-73px)] shrink-0 flex-col border-r lg:flex",
            sidebarCollapsed ? "w-20" : "w-64",
          ].join(" ")}
        >
          <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <h1 className="text-base font-bold">Property Workspace</h1>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Select a property to view live details
                </p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((current) => !current)}
              className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <span className="material-symbols-outlined text-xl">
                {sidebarCollapsed ? "keyboard_tab_rtl" : "keyboard_tab"}
              </span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-36">
            {!sidebarCollapsed ? <div className="mb-4" /> : null}
            <nav className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={
                    normalizedPathname ===
                    (item.href.replace(/\/+$/, "") || "/")
                  }
                  collapsed={sidebarCollapsed}
                />
              ))}
              <div className="pb-2 pt-4">
                {!sidebarCollapsed ? (
                  <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    System
                  </p>
                ) : (
                  <div className="mx-auto h-px w-8 bg-slate-300 dark:bg-slate-600" />
                )}
              </div>
              <a
                className={[
                  "group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/80",
                  sidebarCollapsed ? "justify-center" : "gap-3",
                ].join(" ")}
                href="#"
                title={sidebarCollapsed ? "Settings" : undefined}
              >
                <span className="material-symbols-outlined text-xl group-hover:text-primary">
                  settings
                </span>
                {!sidebarCollapsed ? <span>Settings</span> : null}
              </a>
            </nav>
          </div>
        </aside>

        <div
          className={[
            "fixed bottom-0 left-0 z-40 hidden pb-6 lg:block",
            sidebarCollapsed ? "flex w-20 justify-center px-3" : "w-64 px-6",
          ].join(" ")}
        >
          <div
            className={[
              "bg-primary text-white shadow-panel",
              sidebarCollapsed
                ? "flex size-14 items-center justify-center rounded-full"
                : "rounded-2xl p-4",
            ].join(" ")}
          >
            {!sidebarCollapsed ? (
              <p className="mb-1 text-xs opacity-80">{sidebarMetricLabel}</p>
            ) : null}
            <p
              className={
                sidebarCollapsed
                  ? "text-center text-base font-bold"
                  : "text-xl font-bold"
              }
            >
              {sidebarMetricValue}
            </p>
            {!sidebarCollapsed ? (
              <div className="mt-3 h-1.5 w-full rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${sidebarMetricProgress}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>

        <main
          className={[
            "flex-1 overflow-y-auto p-6 lg:p-8",
            sidebarCollapsed ? "lg:ml-20" : "lg:ml-64",
          ].join(" ")}
        >
          {children}
        </main>
      </div>
    </div>
  );
}


