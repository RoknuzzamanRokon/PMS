"use client";

import { useEffect, useMemo, useState } from "react";
import { PmsShell } from "./pms-shell";
import { fetchJson } from "../lib/api";

const fallbackData = {
  property: { property_id: "PROP001", name: "Grand Plaza Hotel" },
  summary: {
    total_rooms: 5,
    available_inventory: 39,
    sold_inventory: 58,
    blocked_inventory: 2,
    occupancy_percent: 69.7,
  },
  categories: [],
  rooms: [],
};

export function RoomsManagementPage() {
  const [data, setData] = useState(fallbackData);
  const [apiConnected, setApiConnected] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadOverview() {
      try {
        const overview = await fetchJson("/rooms/overview?property_id=PROP001");
        if (!ignore) {
          setData(overview);
          setApiConnected(true);
        }
      } catch {
        if (!ignore) {
          setApiConnected(false);
        }
      }
    }

    loadOverview();
    return () => {
      ignore = true;
    };
  }, []);

  const summaryCards = useMemo(
    () => [
      ["Total Rooms", "meeting_room", String(data.summary.total_rooms), `${data.property.name} is synced from the backend property feed.`, "slate"],
      ["Available", "check_circle", String(data.summary.available_inventory), "Available inventory across linked rate plans.", "emerald"],
      ["Booked", "bedtime", String(data.summary.sold_inventory), "Sold inventory from current rate plan totals.", "blue"],
      ["Blocked", "block", String(data.summary.blocked_inventory), "Derived from CTA, CTD, or stop-sell flags.", "amber"],
      ["Occupancy", "bar_chart", `${data.summary.occupancy_percent}%`, "Calculated from sold versus total inventory.", "slate"],
    ],
    [data],
  );

  return (
    <PmsShell
      searchPlaceholder="Search rooms or categories..."
      sidebarMetricLabel="Total Occupancy"
      sidebarMetricValue={`${data.summary.occupancy_percent}%`}
      sidebarMetricProgress={Math.max(10, Math.min(100, Math.round(data.summary.occupancy_percent)))}
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <span className="material-symbols-outlined text-base">hotel</span>
            Property + Room Type + Inventory
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Rooms Management</h2>
          <p className="max-w-3xl text-sm text-slate-500">
            Summary cards, category panels, and room table below are all fed by
            the new `/api/v1/rooms/overview` endpoint.
          </p>
        </div>
        <div
          className={[
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
            apiConnected
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-amber-200 bg-amber-50 text-amber-700",
          ].join(" ")}
        >
          <span className="material-symbols-outlined text-base">
            {apiConnected ? "sync" : "cloud_off"}
          </span>
          {apiConnected ? "Rooms API Live" : "Using Local Fallback"}
        </div>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map(([title, icon, value, note, tone]) => (
          <article
            key={title}
            className={[
              "rounded-xl bg-white p-5 shadow-sm",
              tone === "emerald" && "border border-emerald-200",
              tone === "blue" && "border border-blue-200",
              tone === "amber" && "border border-amber-200",
              tone === "slate" && "border border-slate-200",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {title}
              </p>
              <span
                className={[
                  "material-symbols-outlined rounded-lg p-2",
                  tone === "emerald" && "bg-emerald-100 text-emerald-600",
                  tone === "blue" && "bg-blue-100 text-blue-600",
                  tone === "amber" && "bg-amber-100 text-amber-600",
                  tone === "slate" && "bg-slate-100 text-slate-600",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {icon}
              </span>
            </div>
            <p className="text-3xl font-bold">{value}</p>
            {title === "Occupancy" ? (
              <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${data.summary.occupancy_percent}%` }}
                />
              </div>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">{note}</p>
          </article>
        ))}
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold">Status Overview</h3>
              <p className="mt-1 text-sm text-slate-500">
                Real inventory and occupancy metrics from the backend overview feed.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-bold">Property</p>
              <p className="text-slate-500">{data.property.name}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">Inventory Mix</p>
                <span className="text-xs font-medium text-slate-500">
                  API totals
                </span>
              </div>
              <div className="space-y-3">
                {[
                  ["Available", `${data.summary.available_inventory} units`, "w-[55%]", "bg-emerald-500", "text-emerald-600"],
                  ["Booked", `${data.summary.sold_inventory} units`, "w-[35%]", "bg-blue-500", "text-blue-600"],
                  ["Blocked", `${data.summary.blocked_inventory} flags`, "w-[10%]", "bg-amber-500", "text-amber-600"],
                ].map(([label, value, width, color, text]) => (
                  <div key={label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-500">{label}</span>
                      <span className={`font-bold ${text}`}>{value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${width} ${color}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">Operational Feed</p>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                  Live
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Property ID", data.property.property_id],
                  ["Categories", `${data.categories.length}`],
                  ["Room Rows", `${data.rooms.length}`],
                  ["Endpoint", "/api/v1/rooms/overview"],
                ].map(([label, text]) => (
                  <div key={label} className="rounded-lg bg-slate-50 p-3">
                    <p className="font-semibold">{label}</p>
                    <p className="mt-1 text-xs text-slate-500">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-xl font-bold">Room Categories</h3>
            <p className="mt-1 text-sm text-slate-500">
              Built from backend room and rate-plan relations.
            </p>
          </div>
          <div className="space-y-3">
            {data.categories.map((category) => (
              <article key={category.room_id} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{category.room_name}</p>
                    <p className="text-xs text-slate-500">
                      {category.room_id} • {category.rate_plan_count} rate plans
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    Active
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    Base Rate: ${Number(category.base_rate).toFixed(2)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    Available: {category.available_inventory}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    Sold: {category.sold_inventory}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">Room Inventory Table</h3>
            <p className="mt-1 text-sm text-slate-500">
              Directly rendered from the room overview response.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-3">Room</th>
                <th className="pb-3">Property</th>
                <th className="pb-3">Base Rate</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Housekeeping</th>
                <th className="pb-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rooms.map((row) => (
                <tr key={row.room_id}>
                  {[row.room_id, row.property_id, `$${Number(row.base_rate).toFixed(2)}`, row.status, row.housekeeping_status, row.note].map(
                    (cell, index) => (
                      <td
                        key={`${row.room_id}-${index}`}
                        className="py-4 pr-4 text-slate-600 first:font-bold first:text-slate-900"
                      >
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PmsShell>
  );
}
