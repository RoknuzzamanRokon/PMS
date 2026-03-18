import { PmsShell } from "./pms-shell";

const summaryCards = [
  ["Total Rooms", "meeting_room", "128", "Across 6 active room categories for Grand Plaza Hotel.", "slate"],
  ["Available", "check_circle", "74", "57.8% of total inventory open for sale tonight.", "emerald"],
  ["Booked", "bedtime", "42", "Includes stayovers and confirmed arrivals in inventory.", "blue"],
  ["Blocked", "block", "12", "Held for maintenance, owner use, or manual restriction.", "amber"],
  ["Occupancy", "bar_chart", "78.4%", "Based on booked plus blocked rooms versus total rooms.", "slate"],
];

export function RoomsManagementPage() {
  return (
    <PmsShell
      searchPlaceholder="Search rooms or categories..."
      sidebarMetricLabel="Total Occupancy"
      sidebarMetricValue="78.4%"
      sidebarMetricProgress={78}
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <span className="material-symbols-outlined text-base">hotel</span>
            Property + Room Type + Inventory
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Rooms Management</h2>
          <p className="max-w-3xl text-sm text-slate-500">
            Monitor hotel room status, manage room categories, and add single
            or multiple rooms from one operational workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            <span className="material-symbols-outlined">file_download</span>
            Export Room List
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:opacity-90">
            <span className="material-symbols-outlined">add_business</span>
            Add Rooms
          </button>
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
                <div className="h-full w-[78%] rounded-full bg-primary" />
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
                Schema-safe inventory metrics with space for future operational
                room statuses.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-bold">Property</p>
              <p className="text-slate-500">Grand Plaza Hotel • London</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">Inventory Mix</p>
                <span className="text-xs font-medium text-slate-500">
                  ROOM_INVENTORY
                </span>
              </div>
              <div className="space-y-3">
                {[
                  ["Available", "74 rooms", "w-[58%]", "bg-emerald-500", "text-emerald-600"],
                  ["Booked", "42 rooms", "w-[33%]", "bg-blue-500", "text-blue-600"],
                  ["Blocked", "12 rooms", "w-[9%]", "bg-amber-500", "text-amber-600"],
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
                <p className="text-sm font-bold">Future Operational Status</p>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                  Reserved
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Ready", "Placeholder for housekeeping-ready state."],
                  ["Dirty", "Placeholder for turnover tracking."],
                  ["Maintenance", "Planned extension beyond blocked inventory."],
                  ["Out of Order", "Future exception state for operations."],
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
              Manage `ROOM_TYPE` details and inventory baselines.
            </p>
          </div>
          <div className="space-y-3">
            {[
              ["Deluxe King", "ROOM_TYPE: DLX-KING • 24 rooms", "Active", "emerald", ["Max Adults: 2", "Max Children: 1", "Amenities: Wi-Fi, City View"]],
              ["Executive Twin", "ROOM_TYPE: EXE-TWN • 18 rooms", "Linked", "blue", ["Max Adults: 2", "Max Children: 2", "Amenities: Work Desk, Smart TV"]],
              ["Family Suite", "ROOM_TYPE: FAM-STE • 14 rooms", "Premium", "amber", ["Max Adults: 4", "Max Children: 2", "Amenities: Sofa Bed, Bathtub"]],
            ].map(([title, subtitle, badge, tone, pills]) => (
              <article key={title} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="text-xs text-slate-500">{subtitle}</p>
                  </div>
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                      tone === "emerald" && "bg-emerald-100 text-emerald-700",
                      tone === "blue" && "bg-blue-100 text-blue-700",
                      tone === "amber" && "bg-amber-100 text-amber-700",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {badge}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {pills.map((pill) => (
                    <span key={pill} className="rounded-full bg-slate-100 px-2.5 py-1">
                      {pill}
                    </span>
                  ))}
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
              Example listing for active rooms and their operational state.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">
              Filter
            </button>
            <button className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white">
              Add Single Room
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-3">Room</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Floor</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Housekeeping</th>
                <th className="pb-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ["101", "Deluxe King", "1", "Available", "Ready", "Near elevator"],
                ["203", "Executive Twin", "2", "Booked", "Clean", "VIP pre-assigned"],
                ["407", "Family Suite", "4", "Blocked", "Maintenance", "AC inspection"],
                ["611", "Presidential Suite", "6", "Booked", "Inspection", "Late arrival"],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td key={`${row[0]}-${index}`} className="py-4 pr-4 text-slate-600 first:font-bold first:text-slate-900">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PmsShell>
  );
}
