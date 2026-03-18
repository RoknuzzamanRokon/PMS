import { PmsShell } from "./pms-shell";

const statCards = [
  ["Occupancy", "hotel_class", "78.4%", "100 occupied or blocked rooms out of 128 total.", "primary"],
  ["Revenue Today", "payments", "$18,420", "Up 12.8% compared with the same day last week.", "emerald"],
  ["Arrivals Today", "login", "24", "9 VIP, 11 OTA, 4 direct corporate check-ins.", "blue"],
  ["Departures Today", "logout", "19", "6 late check-out requests still pending approval.", "amber"],
];

const actionItems = [
  ["warning", "6 late check-outs pending", "Review inventory impact before assigning walk-in rooms.", "amber"],
  ["construction", "3 rooms blocked for maintenance", "Expected release after 14:00 inspection today.", "rose"],
  ["stars", "9 VIP arrivals today", "Pre-assign upgraded rooms and amenity setup before 12:00.", "blue"],
];

export function DashboardPage() {
  return (
    <PmsShell
      searchPlaceholder="Search bookings, guests, rooms..."
      sidebarMetricLabel="Revenue Today"
      sidebarMetricValue="$18,420"
      sidebarMetricProgress={72}
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <span className="material-symbols-outlined text-base">analytics</span>
            Live Hotel Overview
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="max-w-3xl text-sm text-slate-500">
            Track occupancy, revenue, arrivals, departures, and room
            operations from one daily control center.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            <span className="material-symbols-outlined">download</span>
            Export Summary
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:opacity-90">
            <span className="material-symbols-outlined">bolt</span>
            Open Morning Brief
          </button>
        </div>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(([title, icon, value, note, tone]) => (
          <article
            key={title}
            className={[
              "rounded-xl bg-white p-5 shadow-sm",
              tone === "emerald" && "border border-emerald-200",
              tone === "blue" && "border border-blue-200",
              tone === "amber" && "border border-amber-200",
              tone === "primary" && "border border-slate-200",
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
                  tone === "primary" && "bg-primary/10 text-primary",
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
                <div className="h-full w-[78%] rounded-full bg-primary" />
              </div>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">{note}</p>
          </article>
        ))}
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold">Performance Snapshot</h3>
              <p className="mt-1 text-sm text-slate-500">
                High-level KPIs for sales, inventory, and guest movement.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-bold">Date</p>
              <p className="text-slate-500">15 March 2026 • Sunday</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">Revenue Mix</p>
                <span className="text-xs font-medium text-slate-500">
                  ADR / RevPAR
                </span>
              </div>
              <div className="space-y-3">
                {[
                  ["ADR", "$186", "w-[64%]", "bg-primary", "text-slate-900"],
                  ["RevPAR", "$146", "w-[58%]", "bg-emerald-500", "text-emerald-600"],
                  ["Forecast Pace", "+8.2%", "w-[71%]", "bg-blue-500", "text-blue-600"],
                ].map(([label, value, width, bar, color]) => (
                  <div key={label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-500">{label}</span>
                      <span className={`font-bold ${color}`}>{value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${width} ${bar}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">House Status</p>
                <span className="text-xs font-medium text-slate-500">
                  Operations
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Available", "74 rooms"],
                  ["Blocked", "12 rooms"],
                  ["Clean Ready", "61 rooms"],
                  ["Inspect Needed", "7 rooms"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 p-3">
                    <p className="font-semibold">{label}</p>
                    <p className="mt-1 text-xs text-slate-500">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-xl font-bold">Action Center</h3>
            <p className="mt-1 text-sm text-slate-500">
              Priority items that need attention this shift.
            </p>
          </div>
          <div className="space-y-3">
            {actionItems.map(([icon, title, text, tone]) => (
              <article
                key={title}
                className={[
                  "rounded-xl p-4",
                  tone === "amber" && "border border-amber-200 bg-amber-50/60",
                  tone === "rose" && "border border-rose-200 bg-rose-50/60",
                  tone === "blue" && "border border-blue-200 bg-blue-50/60",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={[
                      "material-symbols-outlined",
                      tone === "amber" && "text-amber-600",
                      tone === "rose" && "text-rose-600",
                      tone === "blue" && "text-blue-600",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {icon}
                  </span>
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="mt-1 text-sm text-slate-600">{text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="text-xl font-bold">Arrivals Today</h3>
            <p className="mt-1 text-sm text-slate-500">
              Front-desk preparation for inbound guests.
            </p>
          </div>
          <div className="divide-y divide-slate-200">
            {[
              ["BR-54812 • James Smith", "Deluxe King • ETA 13:40 • 2 nights", "VIP", "blue"],
              ["BR-54845 • Sofia Chen", "Executive Twin • ETA 15:15 • 3 nights", "OTA", "emerald"],
              ["BR-54903 • Daniel Reed", "Suite • ETA 18:00 • 1 night", "Direct", "amber"],
            ].map(([name, meta, badge, tone]) => (
              <article key={name} className="px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{name}</p>
                    <p className="text-sm text-slate-500">{meta}</p>
                  </div>
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      tone === "blue" && "bg-blue-100 text-blue-700",
                      tone === "emerald" && "bg-emerald-100 text-emerald-700",
                      tone === "amber" && "bg-amber-100 text-amber-700",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {badge}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold">Housekeeping</h3>
          <p className="mt-1 text-sm text-slate-500">Room readiness by shift.</p>
          <div className="mt-5 space-y-4">
            {[
              ["Cleaned", "61", "bg-emerald-500", "w-[76%]"],
              ["In Progress", "14", "bg-blue-500", "w-[42%]"],
              ["Inspection", "7", "bg-amber-500", "w-[22%]"],
            ].map(([label, value, color, width]) => (
              <div key={label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-600">{label}</span>
                  <span className="font-bold">{value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${color} ${width}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold">Notes</h3>
          <p className="mt-1 text-sm text-slate-500">
            Shift handover summary and reminders.
          </p>
          <div className="mt-5 space-y-3">
            {[
              "Lobby group arrival moved to 16:00 check-in window.",
              "Spa package upsell is converting well on OTA arrivals.",
              "Engineering requested room 604 access after noon departure.",
            ].map((item) => (
              <div key={item} className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </PmsShell>
  );
}
