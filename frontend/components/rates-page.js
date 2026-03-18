"use client";

import { useMemo, useState } from "react";
import { PmsShell } from "./pms-shell";

const totalDays = 30;
const todayIndex = 4;

const summaryStats = [
  {
    label: "Publish Queue",
    value: "14 changes",
    note: "7 need review before push",
    icon: "publish",
    tone: "primary",
  },
  {
    label: "ADR Today",
    value: "$214.50",
    note: "+$16.30 vs comp set",
    icon: "payments",
    tone: "emerald",
  },
  {
    label: "High Demand Days",
    value: "5 days",
    note: "Weekend compression building",
    icon: "trending_up",
    tone: "amber",
  },
  {
    label: "Restrictions Active",
    value: "3 rules",
    note: "Min stay and CTA mix applied",
    icon: "rule_settings",
    tone: "blue",
  },
];

const roomGroups = [
  {
    title: "Deluxe Suite",
    code: "DLX-SUI",
    subtitle: "12 rooms",
    occupancy: "92%",
    strategy: "Push premium on Fri-Sun",
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
    code: "STD-DBL",
    subtitle: "45 rooms",
    occupancy: "54%",
    strategy: "Keep parity with compset",
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
  {
    title: "Executive Twin",
    code: "EXE-TWN",
    subtitle: "18 rooms",
    occupancy: "76%",
    strategy: "Corporate pace is healthy",
    cells: [
      { note: "Base", value: "$180", tone: "default" },
      { note: "Base", value: "$180", tone: "default" },
      { note: "Lift", value: "$195", tone: "amber" },
      { note: "Lift", value: "$195", tone: "amber" },
      { note: "Today", value: "$210", tone: "primary" },
      { note: "Push", value: "$225", tone: "emerald" },
      { note: "Push", value: "$235", tone: "emerald" },
    ],
  },
  {
    title: "Single Economy",
    code: "SGL-ECO",
    subtitle: "8 rooms",
    occupancy: "33%",
    strategy: "Use as entry price fence",
    cells: [
      { note: "Closed", value: "Sold Out", tone: "disabled" },
      { note: "Base", value: "$95", tone: "default" },
      { note: "Base", value: "$95", tone: "default" },
      { note: "Soft", value: "$85", tone: "default" },
      { note: "Today", value: "$85", tone: "today-soft" },
      { note: "Lift", value: "$110", tone: "amber" },
      { note: "Lift", value: "$125", tone: "default" },
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
  blue: {
    box: "rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2.5 ring-1 ring-blue-100",
    note: "mb-1 block text-[10px] font-bold uppercase tracking-wider text-blue-600",
    input:
      "w-full border-none bg-transparent p-0 text-left text-sm font-bold text-blue-700 focus:ring-0",
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

const insightCards = [
  {
    title: "Today's Suggestions",
    items: [
      "Deluxe Suite can hold +$20 without dropping below target conversion.",
      "Executive Twin is pacing above forecast for the next 3 nights.",
      "Single Economy should stay low to protect funnel entry.",
    ],
  },
  {
    title: "Restriction Watch",
    items: [
      "Add 2-night minimum for Saturday on Deluxe Suite.",
      "Close arrival on Single Economy for Oct 22 if occupancy crosses 80%.",
      "Review OTA markup before pushing publish batch.",
    ],
  },
];

function createDays() {
  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(2023, 9, index + 1);
    return {
      shortDay: date.toLocaleDateString("en-US", { weekday: "short" }),
      dayNum: String(index + 1).padStart(2, "0"),
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
  const days = useMemo(createDays, []);

  const rows = useMemo(
    () =>
      roomGroups.map((row) => ({
        ...row,
        cells: Array.from({ length: totalDays }, (_, index) => {
          const seed = row.cells[index % row.cells.length];
          if (index === todayIndex) {
            return {
              ...seed,
              note: "Today",
              tone: seed.tone === "disabled" ? "disabled" : "primary",
            };
          }
          return { ...seed };
        }),
      })),
    [],
  );

  return (
    <PmsShell
      searchPlaceholder="Search rooms or guests..."
      sidebarMetricLabel="Total Occupancy"
      sidebarMetricValue="84.2%"
      sidebarMetricProgress={84}
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <span className="material-symbols-outlined text-base">sell</span>
            Revenue Control Desk
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Daily Rates &amp; Yield</h2>
          <p className="max-w-3xl text-sm text-slate-500">
            Focus the pricing team on the days and room types that actually need
            action, with clearer signals for review, publish, and restrictions.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            <span className="material-symbols-outlined">history</span>
            View Audit Log
          </button>
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
            <div className="flex gap-2 rounded-lg bg-slate-100 p-1">
              {["All Rooms", "Deluxe", "Standard", "Single"].map((label, index) => (
                <button
                  key={label}
                  className={[
                    "rounded-md px-4 py-1.5 text-sm",
                    index === 0
                      ? "bg-white font-medium text-slate-900 shadow-sm"
                      : "font-medium text-slate-500 hover:text-slate-900",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">
              <span className="material-symbols-outlined text-base text-primary">
                calendar_month
              </span>
              October 2023
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
              <button className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-50">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                Today
              </button>
              <button className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-50">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
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
              ["Auto Rules", "6 active"],
              ["Channel", "Direct + OTA"],
              ["Restriction Mode", "Soft"],
              ["Review Scope", "Only flagged cells"],
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
              Edit flagged prices quickly without losing room-type context.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
              Strong demand
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
              Suggest review
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
                </div>

                {row.cells.slice(0, range).map((cell, index) => {
                  const styles = toneClasses[cell.tone];
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
