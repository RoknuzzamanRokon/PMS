import { PmsShell } from "./pms-shell";

const days = [
  ["Mon", "12 Oct", false, false],
  ["Tue", "13 Oct", false, false],
  ["Today", "14 Oct", true, false],
  ["Thu", "15 Oct", false, false],
  ["Fri", "16 Oct", false, false],
  ["Sat", "17 Oct", false, true],
  ["Sun", "18 Oct", false, true],
  ["Mon", "19 Oct", false, false],
  ["Tue", "20 Oct", false, false],
  ["Wed", "21 Oct", false, false],
  ["Thu", "22 Oct", false, false],
  ["Fri", "23 Oct", false, false],
  ["Sat", "24 Oct", false, true],
  ["Sun", "25 Oct", false, true],
];

const rows = [
  {
    room: "101",
    type: "Deluxe King",
    booking: { left: "0px", width: "300px", tone: "blue", guest: "Smith, James", meta: "#RES-40291 • 3 Guests" },
  },
  {
    room: "102",
    type: "Deluxe King",
    booking: { left: "100px", width: "400px", tone: "green", guest: "Garcia, Maria", meta: "#RES-40262 • Checked-in" },
  },
  {
    room: "204",
    type: "Executive Twin",
    booking: { left: "220px", width: "180px", tone: "amber", guest: "Pending Hold", meta: "Corporate allotment" },
  },
  {
    room: "305",
    type: "Family Suite",
    booking: { left: "500px", width: "280px", tone: "blue", guest: "Chen, Sofia", meta: "#RES-40318 • 4 Guests" },
  },
];

export function InventoryPage() {
  return (
    <PmsShell
      searchPlaceholder="Search rooms or guests..."
      sidebarMetricLabel="Total Occupancy"
      sidebarMetricValue="84.2%"
      sidebarMetricProgress={84}
    >
      <div className="-m-6 flex min-h-[calc(100vh-108px)] flex-col overflow-hidden lg:-m-8">
        <div className="border-b border-slate-200 bg-white px-6 py-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Inventory Calendar
              </h2>
              <p className="text-sm text-slate-500">
                Real-time room availability for Oct 12 - Oct 25, 2023
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg bg-slate-100 p-1">
                <button className="rounded-md p-1.5 text-slate-600 hover:bg-white hover:text-primary">
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <button className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                  Today
                </button>
                <button className="rounded-md p-1.5 text-slate-600 hover:bg-white hover:text-primary">
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
              <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-sm">add</span>
                <span>Quick Booking</span>
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {[
              ["filter_alt", "Room Type:", "All Types"],
              ["stairs", "Floor:", "All Floors"],
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
              {days.map(([day, date, today, weekend]) => (
                <div
                  key={date}
                  className={[
                    "flex flex-col items-center justify-center border-r border-slate-200 p-2",
                    today && "bg-slate-50",
                    weekend && "bg-slate-100/60",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span
                    className={[
                      "text-[10px] font-bold uppercase",
                      today ? "text-primary" : "text-slate-400",
                    ].join(" ")}
                  >
                    {day}
                  </span>
                  <span
                    className={[
                      "text-sm font-bold",
                      today ? "text-primary" : "text-slate-800",
                    ].join(" ")}
                  >
                    {date}
                  </span>
                </div>
              ))}
            </div>

            <div className="divide-y divide-slate-200">
              {rows.map((row) => (
                <div key={row.room} className="calendar-grid h-16">
                  <div className="flex flex-col justify-center border-r border-slate-200 bg-white p-4">
                    <span className="text-sm font-bold leading-none">{row.room}</span>
                    <span className="mt-1 text-[10px] font-medium uppercase text-slate-500">
                      {row.type}
                    </span>
                  </div>
                  <div className="relative col-span-14 grid h-full grid-cols-14 border-r border-slate-100 bg-white">
                    <div className="pointer-events-none absolute left-[200px] top-0 h-full w-[100px] border-x border-primary/10 bg-primary/5" />
                    <div
                      className="absolute top-2 z-10 h-12 px-1"
                      style={{ left: row.booking.left, width: row.booking.width }}
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
                          {row.booking.guest}
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
