"use client";

import { useEffect, useMemo, useState } from "react";
import { PmsShell } from "./pms-shell";
import { fetchJson } from "../lib/api";

function buildDays(startDate, totalDays) {
  const start = new Date(startDate);
  return Array.from({ length: totalDays }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const today = index === 0;
    const shortDay = current.toLocaleDateString("en-US", { weekday: "short" });
    return {
      label: today ? "Today" : shortDay,
      date: current.toLocaleDateString("en-US", { day: "2-digit", month: "short" }),
      today,
      weekend: shortDay === "Sat" || shortDay === "Sun",
    };
  });
}

const fallbackCalendar = {
  property: { property_id: "PROP001", name: "Selected Property" },
  start_date: new Date().toISOString().slice(0, 10),
  days: 14,
  rows: [],
};

export function InventoryPage() {
  const [calendar, setCalendar] = useState(fallbackCalendar);
  const [apiConnected, setApiConnected] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadCalendar() {
      try {
        const data = await fetchJson("/inventory/calendar?property_id=PROP001&days=14");
        if (!ignore) {
          setCalendar(data);
          setApiConnected(true);
        }
      } catch {
        if (!ignore) {
          setApiConnected(false);
        }
      }
    }

    loadCalendar();
    return () => {
      ignore = true;
    };
  }, []);

  const days = useMemo(
    () => buildDays(calendar.start_date, calendar.days),
    [calendar.days, calendar.start_date],
  );

  return (
    <PmsShell
      searchPlaceholder="Search rooms or guests..."
      sidebarMetricLabel="Calendar Rows"
      sidebarMetricValue={`${calendar.rows.length}`}
      sidebarMetricProgress={Math.max(20, Math.min(100, calendar.rows.length * 18))}
    >
      <div className="-m-6 flex min-h-[calc(100vh-108px)] flex-col overflow-hidden lg:-m-8">
        <div className="border-b border-slate-200 bg-white px-6 py-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Inventory Calendar
              </h2>
              <p className="text-sm text-slate-500">
                Real bookings by room from `/api/v1/inventory/calendar` for {calendar.property.name}
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
                {apiConnected ? "view_timeline" : "cloud_off"}
              </span>
              {apiConnected ? "Inventory API Live" : "Using Local Fallback"}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {[
              ["filter_alt", "Property:", calendar.property.property_id],
              ["calendar_month", "Start:", calendar.start_date],
              ["hotel", "Rows:", `${calendar.rows.length}`],
            ].map(([icon, label, value]) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5"
              >
                <span className="material-symbols-outlined text-lg text-slate-400">
                  {icon}
                </span>
                <span className="text-xs font-bold text-slate-700">{label}</span>
                <span className="text-xs font-medium text-primary">{value}</span>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-6">
              {[
                ["bg-blue-500", "Confirmed"],
                ["bg-green-500", "Checked-in"],
                ["bg-amber-400", "Pending"],
              ].map(([color, label]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${color}`} />
                  <span className="text-[11px] font-medium text-slate-500">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-auto bg-slate-50">
          <div className="min-w-max">
            <div className="calendar-grid sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-r border-slate-200 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Rooms
                </span>
                <span className="material-symbols-outlined text-sm text-slate-400">
                  unfold_more
                </span>
              </div>
              {days.map((day) => (
                <div
                  key={`${day.label}-${day.date}`}
                  className={[
                    "flex flex-col items-center justify-center border-r border-slate-200 p-2",
                    day.today && "bg-slate-50",
                    day.weekend && "bg-slate-100/60",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span
                    className={[
                      "text-[10px] font-bold uppercase",
                      day.today ? "text-primary" : "text-slate-400",
                    ].join(" ")}
                  >
                    {day.label}
                  </span>
                  <span
                    className={[
                      "text-sm font-bold",
                      day.today ? "text-primary" : "text-slate-800",
                    ].join(" ")}
                  >
                    {day.date}
                  </span>
                </div>
              ))}
            </div>

            <div className="divide-y divide-slate-200">
              {calendar.rows.map((row) => (
                <div key={row.room_id} className="calendar-grid h-16">
                  <div className="flex flex-col justify-center border-r border-slate-200 bg-white p-4">
                    <span className="text-sm font-bold leading-none">{row.room_id}</span>
                    <span className="mt-1 text-[10px] font-medium uppercase text-slate-500">
                      {row.room_name}
                    </span>
                  </div>
                  <div className="relative col-span-14 grid h-full grid-cols-14 border-r border-slate-100 bg-white">
                    <div className="pointer-events-none absolute left-[0px] top-0 h-full w-[100px] border-x border-primary/10 bg-primary/5" />
                    {row.booking ? (
                      <div
                        className="absolute top-2 z-10 h-12 px-1"
                        style={{
                          left: `${row.booking.left_days * 100}px`,
                          width: `${row.booking.duration_days * 100}px`,
                        }}
                      >
                        <div
                          className={[
                            "flex h-full cursor-pointer flex-col justify-center overflow-hidden rounded-lg border-l-4 p-2 transition-all",
                            row.booking.tone === "blue" &&
                              "border-blue-500 bg-blue-500/15 hover:bg-blue-500/25",
                            row.booking.tone === "green" &&
                              "border-green-500 bg-green-500/15 hover:bg-green-500/25",
                            row.booking.tone === "amber" &&
                              "border-amber-500 bg-amber-500/15 hover:bg-amber-500/25",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <p
                            className={[
                              "truncate text-[10px] font-black uppercase",
                              row.booking.tone === "blue" && "text-blue-700",
                              row.booking.tone === "green" && "text-green-700",
                              row.booking.tone === "amber" && "text-amber-700",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            {row.booking.guest_name}
                          </p>
                          <p
                            className={[
                              "truncate text-[9px]",
                              row.booking.tone === "blue" && "text-blue-600",
                              row.booking.tone === "green" && "text-green-600",
                              row.booking.tone === "amber" && "text-amber-600",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            {row.booking.meta}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-y-0 left-0 flex items-center px-4 text-xs font-medium text-slate-400">
                        No booking in selected window
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PmsShell>
  );
}
