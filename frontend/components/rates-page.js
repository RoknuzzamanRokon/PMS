"use client";

import { useEffect, useMemo, useState } from "react";
import { PmsShell } from "./pms-shell";
import { fetchJson } from "../lib/api";

const totalDays = 30;
const todayIndex = 4;

const fallbackRows = [
  {
    title: "Deluxe Suite",
    code: "RATE001",
    subtitle: "12 rooms",
    occupancy: "92%",
    strategy: "Push premium on Fri-Sun",
    stopSell: false,
    cta: false,
    ctd: false,
    cells: [
      { note: "Base", value: "$240", tone: "default" },
      { note: "High", value: "$285", tone: "emerald" },
      { note: "Base", value: "$240", tone: "default" },
      { note: "Soft", value: "$210", tone: "default" },
      { note: "Today", value: "$310", tone: "primary" },
      { note: "Suggest", value: "$290", tone: "amber" },
      { note: "High", value: "$320", tone: "emerald" },
    ],
  },
  {
    title: "Standard Double",
    code: "RATE002",
    subtitle: "45 rooms",
    occupancy: "54%",
    strategy: "Keep parity with compset",
    stopSell: false,
    cta: false,
    ctd: false,
    cells: [
      { note: "Base", value: "$145", tone: "default" },
      { note: "Base", value: "$145", tone: "default" },
      { note: "Base", value: "$145", tone: "default" },
      { note: "Soft", value: "$130", tone: "default" },
      { note: "Today", value: "$145", tone: "today-soft" },
      { note: "Lift", value: "$165", tone: "amber" },
      { note: "Lift", value: "$185", tone: "emerald" },
    ],
  },
];

const toneClasses = {
  default: {
    box: "rounded-xl border border-slate-200 bg-white px-3 py-2.5",
    note: "mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400",
    input:
      "w-full border-none bg-transparent p-0 text-left text-sm font-bold text-slate-900 focus:ring-0",
  },
  emerald: {
    box: "rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 ring-1 ring-emerald-100",
    note: "mb-1 block text-[10px] font-bold uppercase tracking-wider text-emerald-600",
    input:
      "w-full border-none bg-transparent p-0 text-left text-sm font-bold text-emerald-700 focus:ring-0",
  },
  amber: {
    box: "rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 ring-1 ring-amber-100",
    note: "mb-1 block text-[10px] font-bold uppercase tracking-wider text-amber-600",
    input:
      "w-full border-none bg-transparent p-0 text-left text-sm font-bold text-amber-700 focus:ring-0",
  },
  primary: {
    box: "rounded-xl border-2 border-primary bg-primary/[0.03] px-3 py-2.5 shadow-sm",
    note: "mb-1 block text-[10px] font-bold uppercase tracking-wider text-primary",
    input:
      "w-full border-none bg-transparent p-0 text-left text-sm font-bold text-primary focus:ring-0",
  },
  "today-soft": {
    box: "rounded-xl border border-primary/20 bg-primary/[0.03] px-3 py-2.5",
    note: "mb-1 block text-[10px] font-bold uppercase tracking-wider text-primary/70",
    input:
      "w-full border-none bg-transparent p-0 text-left text-sm font-bold text-slate-900 focus:ring-0",
  },
  disabled: {
    box: "rounded-xl border border-slate-200 bg-slate-100/70 px-3 py-2.5",
    note: "mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400",
    input:
      "w-full border-none bg-transparent p-0 text-left text-sm font-bold text-slate-400 focus:ring-0",
  },
};

function createDays() {
  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(2023, 9, index + 1);
    return {
      shortDay: date.toLocaleDateString("en-US", { weekday: "short" }),
      dayNum: String(index + 1).padStart(2, "0"),
    };
  });
}

function getTone(item, index) {
  if (item.availability === "SOLD_OUT") {
    return "disabled";
  }
  if (index === todayIndex) {
    return "primary";
  }
  if (item.availability === "LOW") {
    return "amber";
  }
  return Number(item.base_rate) >= 220 ? "emerald" : "default";
}

function buildRowsFromApi(rooms, ratePlans, calendarByRateId) {
  if (!ratePlans.length) {
    return fallbackRows;
  }

  const roomMap = new Map(rooms.map((room) => [room.room_id, room]));

  return ratePlans.map((ratePlan) => {
    const room = roomMap.get(ratePlan.room_id);
    const calendar = calendarByRateId[ratePlan.rate_id] || [];
    const occupancyPercent = ratePlan.total_inventory
      ? Math.round((ratePlan.sold_inventory / ratePlan.total_inventory) * 100)
      : 0;

    return {
      title: room?.room_name || ratePlan.title,
      code: ratePlan.rate_id,
      subtitle: `${ratePlan.available_inventory} available`,
      occupancy: `${occupancyPercent}%`,
      strategy: ratePlan.description || ratePlan.cancellation_policy,
      stopSell: Boolean(ratePlan.stop_sell),
      cta: Boolean(ratePlan.closed_to_arrival),
      ctd: Boolean(ratePlan.closed_to_departure),
      cells: calendar.map((item, index) => ({
        note: item.availability === "LOW" ? "Review" : index === todayIndex ? "Today" : item.availability,
        value: item.availability === "SOLD_OUT" ? "Sold Out" : `$${Number(item.base_rate).toFixed(0)}`,
        tone: getTone(item, index),
      })),
    };
  });
}

function StatCard({ stat }) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600",
    blue: "bg-blue-100 text-blue-600",
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          {stat.label}
        </p>
        <span
          className={`material-symbols-outlined rounded-lg p-2 ${toneMap[stat.tone]}`}
        >
          {stat.icon}
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
      <p className="mt-2 text-xs text-slate-500">{stat.note}</p>
    </article>
  );
}

export function DailyRatesPage() {
  const [range, setRange] = useState(7);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState("PROP001");
  const [rows, setRows] = useState(fallbackRows);
  const [rooms, setRooms] = useState([]);
  const [apiConnected, setApiConnected] = useState(false);
  const days = useMemo(createDays, []);

  useEffect(() => {
    let ignore = false;

    async function loadRates() {
      try {
        const propertyList = await fetchJson("/properties");
        if (ignore) {
          return;
        }

        const propertyId = propertyList[0]?.property_id || "PROP001";
        setProperties(propertyList);
        setSelectedProperty(propertyId);

        const roomList = await fetchJson(`/rooms?property_id=${propertyId}`);
        if (ignore) {
          return;
        }
        setRooms(roomList);

        const ratePlanLists = await Promise.all(
          roomList.map((room) =>
            fetchJson(`/rate-plans?room_id=${room.room_id}`).catch(() => []),
          ),
        );

        const primaryRatePlans = ratePlanLists
          .map((list) => list[0])
          .filter(Boolean);

        const calendarEntries = await Promise.all(
          primaryRatePlans.map((ratePlan) =>
            fetchJson(`/rate-plans/${ratePlan.rate_id}/calendar`).catch(() => []),
          ),
        );

        if (ignore) {
          return;
        }

        const calendarByRateId = Object.fromEntries(
          primaryRatePlans.map((ratePlan, index) => [
            ratePlan.rate_id,
            calendarEntries[index],
          ]),
        );

        setRows(buildRowsFromApi(roomList, primaryRatePlans, calendarByRateId));
        setApiConnected(true);
      } catch {
        if (!ignore) {
          setApiConnected(false);
          setRows(fallbackRows);
        }
      }
    }

    loadRates();
    return () => {
      ignore = true;
    };
  }, []);

  const summaryStats = useMemo(() => {
    const visibleRows = rows.length ? rows : fallbackRows;
    const allCells = visibleRows.flatMap((row) => row.cells.slice(0, range));
    const numericRates = allCells
      .map((cell) => Number(String(cell.value).replace(/[^0-9.]/g, "")))
      .filter((value) => !Number.isNaN(value) && value > 0);
    const adr = numericRates.length
      ? numericRates.reduce((sum, value) => sum + value, 0) / numericRates.length
      : 0;

    return [
      {
        label: "Publish Queue",
        value: `${allCells.filter((cell) => cell.tone === "amber").length} changes`,
        note: apiConnected ? "Derived from calendar review cells" : "Static demo queue",
        icon: "publish",
        tone: "primary",
      },
      {
        label: "ADR Window",
        value: `$${adr.toFixed(2)}`,
        note: `${visibleRows.length} room groups in view`,
        icon: "payments",
        tone: "emerald",
      },
      {
        label: "Low Availability",
        value: `${allCells.filter((cell) => cell.tone === "amber").length} days`,
        note: "Potential pressure dates in selected view",
        icon: "trending_up",
        tone: "amber",
      },
      {
        label: "Restriction Flags",
        value: `${visibleRows.filter((row) => row.stopSell || row.cta || row.ctd).length} plans`,
        note: "CTA, CTD, or stop-sell enabled",
        icon: "rule_settings",
        tone: "blue",
      },
    ];
  }, [apiConnected, range, rows]);

  const insightCards = useMemo(
    () => [
      {
        title: "API Connection",
        items: [
          apiConnected ? "Connected to FastAPI backend." : "Backend not reachable, showing local fallback data.",
          `Loaded ${properties.length || 1} properties and ${rooms.length || rows.length} room records.`,
          apiConnected ? "Calendar cells are now backed by `/rate-plans/{rate_id}/calendar`." : "Start the backend to hydrate this matrix with live data.",
        ],
      },
      {
        title: "Active Property",
        items: [
          `Property: ${selectedProperty || "PROP001"}`,
          `${rooms.length} rooms fetched for rate review.`,
          "Use these endpoints next for inline edits: bulk-upsert calendar and publish workflows.",
        ],
      },
    ],
    [apiConnected, properties.length, rooms.length, rows.length, selectedProperty],
  );

  return (
    <PmsShell
      searchPlaceholder="Search rooms or guests..."
      sidebarMetricLabel="Rate Plans Loaded"
      sidebarMetricValue={`${rows.length}`}
      sidebarMetricProgress={Math.max(20, Math.min(100, rows.length * 20))}
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <span className="material-symbols-outlined text-base">sell</span>
            Revenue Control Desk
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Daily Rates &amp; Yield</h2>
          <p className="max-w-3xl text-sm text-slate-500">
            This screen now consumes FastAPI properties, rooms, rate plans, and
            calendar data while preserving the demo PMS design.
          </p>
        </div>
        <div className="flex gap-3">
          <div
            className={[
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
              apiConnected
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-amber-200 bg-amber-50 text-amber-700",
            ].join(" ")}
          >
            <span className="material-symbols-outlined text-base">
              {apiConnected ? "hub" : "cloud_off"}
            </span>
            {apiConnected ? "FastAPI Live" : "Fallback Mode"}
          </div>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:opacity-90">
            <span className="material-symbols-outlined">publish</span>
            Publish Changes
          </button>
        </div>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryStats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">
              Property:{" "}
              <span className="font-bold text-slate-900">
                {selectedProperty || "PROP001"}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">
              Rooms Loaded:{" "}
              <span className="font-bold text-slate-900">{rooms.length || rows.length}</span>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">
              Rate Plans: <span className="font-bold text-slate-900">{rows.length}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                View
              </span>
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                {[7, 15, 30].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setRange(size)}
                    className={[
                      "rounded-md px-3 py-1.5 text-sm transition-colors",
                      range === size
                        ? "bg-white font-bold text-slate-900 shadow-sm"
                        : "font-medium text-slate-500 hover:text-slate-900",
                    ].join(" ")}
                  >
                    {size} Days
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {[
              ["API", apiConnected ? "Connected" : "Offline"],
              ["Rooms Endpoint", `/rooms?property_id=${selectedProperty || "PROP001"}`],
              ["Rate Plans", "/rate-plans?room_id=ROOM001"],
              ["Calendar", "/rate-plans/{rate_id}/calendar"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {label}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          {insightCards.map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="text-base font-bold text-slate-900">{card.title}</h3>
              <div className="mt-4 space-y-3">
                {card.items.map((item) => (
                  <div key={item} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {item}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Rate Matrix</h3>
            <p className="text-sm text-slate-500">
              Demo frontend hydrated from FastAPI rate-plan and calendar endpoints.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
              High rate
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
              Low inventory
            </span>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
              Today
            </span>
          </div>
        </div>

        <div className="custom-scrollbar overflow-x-auto overflow-y-hidden">
          <div className="min-w-max" style={{ "--rate-days": String(range) }}>
            <div className="rates-grid sticky top-0 z-20 border-b border-slate-200 bg-white">
              <div className="border-r border-slate-200 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Room Type
                </p>
              </div>
              {days.slice(0, range).map((day, index) => {
                const isToday = index === todayIndex;
                const weekend = day.shortDay === "Sat" || day.shortDay === "Sun";
                return (
                  <div
                    key={`${day.shortDay}-${day.dayNum}`}
                    className={[
                      "border-r border-slate-100 px-3 py-4 text-center",
                      isToday && "bg-primary/[0.04]",
                      !isToday && weekend && "bg-slate-50",
                    ].join(" ")}
                  >
                    <p
                      className={[
                        "text-[10px] font-bold uppercase tracking-wider",
                        isToday ? "text-primary" : "text-slate-400",
                      ].join(" ")}
                    >
                      {isToday ? "Today" : day.shortDay}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {day.dayNum} Oct
                    </p>
                  </div>
                );
              })}
            </div>

            {rows.map((row) => (
              <div key={row.code} className="rates-grid border-b border-slate-100 last:border-b-0">
                <div className="border-r border-slate-200 bg-slate-50/60 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{row.title}</p>
                      <p className="text-xs text-slate-500">
                        {row.code} • {row.subtitle}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {row.occupancy}
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-medium text-slate-500">
                    {row.strategy}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.stopSell ? (
                      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                        Stop Sell
                      </span>
                    ) : null}
                    {row.cta ? (
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                        CTA
                      </span>
                    ) : null}
                    {row.ctd ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        CTD
                      </span>
                    ) : null}
                  </div>
                </div>

                {row.cells.slice(0, range).map((cell, index) => {
                  const styles = toneClasses[cell.tone] || toneClasses.default;
                  return (
                    <div
                      key={`${row.code}-${index}`}
                      className={[
                        "border-r border-slate-100 px-2 py-3",
                        index === todayIndex && "bg-primary/[0.02]",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div className={styles.box}>
                        <span className={styles.note}>{cell.note}</span>
                        <input className={styles.input} defaultValue={cell.value} />
                        <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-slate-400">
                          <span>BAR</span>
                          <span>Edit</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>
    </PmsShell>
  );
}
