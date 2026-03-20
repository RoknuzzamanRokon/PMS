"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, profileImage } from "./data";

function NavLink({ item, active }) {
  return (
    <Link
      href={item.href}
      className={[
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-primary/10 font-bold text-primary"
          : "font-medium text-slate-600 hover:bg-slate-50",
      ].join(" ")}
    >
      <span
        className="material-symbols-outlined text-xl group-hover:text-primary"
        style={active ? { fontVariationSettings: '"FILL" 1' } : undefined}
      >
        {item.icon}
      </span>
      <span>{item.label}</span>
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

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-transparent text-slate-900">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 text-primary">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
              <span className="material-symbols-outlined">domain</span>
            </div>
            <h2 className="text-lg font-bold leading-tight tracking-tight">
              Hotel PMS
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl text-slate-400">
              search
            </span>
            <input
              className="w-64 rounded-lg border-none bg-slate-100 py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary"
              placeholder={searchPlaceholder}
              type="text"
            />
          </div>
          <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-red-500" />
          </button>
          <div className="mx-1 h-8 w-px bg-slate-200" />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold">Alex Rivers</p>
              <p className="text-[10px] text-slate-500">Manager</p>
            </div>
            <div className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10">
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

      <div className="flex grow overflow-hidden">
        <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="p-6">
            <div className="mb-8 flex flex-col">
              <h1 className="text-base font-bold">Property Workspace</h1>
              <p className="text-xs font-medium text-slate-500">
                Select a property to view live details
              </p>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={pathname === item.href}
                />
              ))}
              <div className="pb-2 pt-4">
                <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  System
                </p>
              </div>
              <a
                className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                href="#"
              >
                <span className="material-symbols-outlined text-xl group-hover:text-primary">
                  settings
                </span>
                <span>Settings</span>
              </a>
            </nav>
          </div>
          <div className="mt-auto p-6">
            <div className="rounded-xl bg-primary p-4 text-white shadow-panel">
              <p className="mb-1 text-xs opacity-80">{sidebarMetricLabel}</p>
              <p className="text-xl font-bold">{sidebarMetricValue}</p>
              <div className="mt-3 h-1.5 w-full rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${sidebarMetricProgress}%` }}
                />
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
