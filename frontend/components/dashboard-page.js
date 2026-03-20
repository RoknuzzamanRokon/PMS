"use client";

import { useEffect, useMemo, useState } from "react";
import { PmsShell } from "./pms-shell";
import { fetchJson } from "../lib/api";

const fallbackOverview = {
  summary: {
    properties: 1,
    rooms: 5,
    guests: 4,
    active_rate_plans: 5,
    reservations: 4,
    payments_total: 667,
    occupancy_percent: 69.7,
    arrivals_today: 1,
    departures_today: 0,
  },
  arrivals: [],
  departures: [],
  payments: [],
  top_rate_plans: [],
};

const propertyTypeLabels = {
  HOTEL: "Hotel",
  RESORT: "Resort",
  APARTMENT: "Apartment",
  VILLA: "Villa",
  HOSTEL: "Hostel",
};

function formatPropertyType(type) {
  if (!type) {
    return "Property";
  }

  return propertyTypeLabels[type] || type.toLowerCase().replaceAll("_", " ");
}

function formatTimestamp(value) {
  if (!value) {
    return "Recently added";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently added";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function DashboardPage() {
  const [overview, setOverview] = useState(fallbackOverview);
  const [apiConnected, setApiConnected] = useState(false);
  const [properties, setProperties] = useState([]);
  const [propertiesConnected, setPropertiesConnected] = useState(false);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertySearch, setPropertySearch] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadOverview() {
      try {
        const data = await fetchJson("/dashboard/overview");
        if (!ignore) {
          setOverview(data);
          setApiConnected(true);
        }
      } catch {
        if (!ignore) {
          setApiConnected(false);
        }
      }
    }

    loadOverview();

    async function loadProperties() {
      try {
        const data = await fetchJson("/properties");
        if (!ignore) {
          setProperties(Array.isArray(data) ? data : []);
          setPropertiesConnected(true);
        }
      } catch {
        if (!ignore) {
          setProperties([]);
          setPropertiesConnected(false);
        }
      } finally {
        if (!ignore) {
          setPropertiesLoading(false);
        }
      }
    }

    loadProperties();
    return () => {
      ignore = true;
    };
  }, []);

  const summary = overview.summary;
  const statCards = useMemo(
    () => [
      [
        "Occupancy",
        "hotel_class",
        `${summary.occupancy_percent}%`,
        `${summary.active_rate_plans} active rate plans are contributing inventory.`,
        "primary",
      ],
      [
        "Payments Total",
        "payments",
        `$${Number(summary.payments_total).toLocaleString()}`,
        `${overview.payments.length} recent payment records are visible below.`,
        "emerald",
      ],
      [
        "Arrivals Today",
        "login",
        String(summary.arrivals_today),
        `${overview.arrivals.length} arrivals loaded from the reservation feed.`,
        "blue",
      ],
      [
        "Departures Today",
        "logout",
        String(summary.departures_today),
        `${overview.departures.length} departures loaded from the reservation feed.`,
        "amber",
      ],
    ],
    [overview.arrivals.length, overview.departures.length, overview.payments.length, summary],
  );

  const actionItems = useMemo(
    () => [
      {
        icon: "publish",
        title: `${summary.active_rate_plans} active rate plans`,
        text: "Revenue controls are live and feeding the daily-rates workspace.",
        tone: "blue",
      },
      {
        icon: "meeting_room",
        title: `${summary.rooms} rooms synced`,
        text: "Rooms management is now reading real inventory data from the backend.",
        tone: "emerald",
      },
      {
        icon: "credit_card",
        title: `$${Number(summary.payments_total).toLocaleString()} captured`,
        text: "Recent payments are available for finance and dashboard review.",
        tone: "amber",
      },
    ],
    [summary],
  );

  const filteredProperties = useMemo(() => {
    const query = propertySearch.trim().toLowerCase();

    if (!query) {
      return properties;
    }

    return properties.filter((property) =>
      [property.property_id, property.name, property.name_lang, property.property_type]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [properties, propertySearch]);

  return (
    <PmsShell
      searchPlaceholder="Search bookings, guests, rooms..."
      sidebarMetricLabel="Payments Total"
      sidebarMetricValue={`$${Number(summary.payments_total).toLocaleString()}`}
      sidebarMetricProgress={Math.max(15, Math.min(100, Math.round(summary.occupancy_percent)))}
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <span className="material-symbols-outlined text-base">analytics</span>
            Live Hotel Overview
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="max-w-3xl text-sm text-slate-500">
            All summary cards and activity panels below are now driven by the
            FastAPI backend instead of static demo values.
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
            {apiConnected ? "cloud_done" : "cloud_off"}
          </span>
          {apiConnected ? "Dashboard API Live" : "Using Local Fallback"}
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
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${summary.occupancy_percent}%` }}
                />
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
              <h3 className="text-xl font-bold">API Snapshot</h3>
              <p className="mt-1 text-sm text-slate-500">
                Overview of the data feeding the full PMS demo frontend.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-bold">Source</p>
              <p className="text-slate-500">`/api/v1/dashboard/overview`</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">Entity Totals</p>
                <span className="text-xs font-medium text-slate-500">
                  Live counts
                </span>
              </div>
              <div className="space-y-3">
                {[
                  ["Properties", summary.properties, "w-[25%]", "bg-primary", "text-slate-900"],
                  ["Rooms", summary.rooms, "w-[70%]", "bg-emerald-500", "text-emerald-600"],
                  ["Guests", summary.guests, "w-[52%]", "bg-blue-500", "text-blue-600"],
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
                <p className="text-sm font-bold">Top Rate Plans</p>
                <span className="text-xs font-medium text-slate-500">
                  Sold inventory
                </span>
              </div>
              <div className="space-y-3">
                {overview.top_rate_plans.map((item) => (
                  <div key={item.rate_id} className="rounded-lg bg-slate-50 p-3">
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.rate_id} • sold {item.sold_inventory} • available {item.available_inventory}
                    </p>
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
              API-derived operational highlights for the demo property.
            </p>
          </div>
          <div className="space-y-3">
            {actionItems.map((item) => (
              <article
                key={item.title}
                className={[
                  "rounded-xl p-4",
                  item.tone === "amber" && "border border-amber-200 bg-amber-50/60",
                  item.tone === "emerald" && "border border-emerald-200 bg-emerald-50/60",
                  item.tone === "blue" && "border border-blue-200 bg-blue-50/60",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={[
                      "material-symbols-outlined",
                      item.tone === "amber" && "text-amber-600",
                      item.tone === "emerald" && "text-emerald-600",
                      item.tone === "blue" && "text-blue-600",
                    ].join(" ")}
                  >
                    {item.icon}
                  </span>
                  <div>
                    <p className="font-bold">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="text-xl font-bold">Arrivals Today</h3>
            <p className="mt-1 text-sm text-slate-500">
              Loaded from reservations with today&apos;s check-in date.
            </p>
          </div>
          <div className="divide-y divide-slate-200">
            {overview.arrivals.map((arrival) => (
              <article key={arrival.booking_id} className="px-6 py-4">
                <p className="font-bold text-slate-900">
                  {arrival.booking_id} • {arrival.guest_name}
                </p>
                <p className="text-sm text-slate-500">
                  {arrival.room_name} • status {arrival.booking_status}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold">Recent Payments</h3>
          <p className="mt-1 text-sm text-slate-500">
            Most recent payment events from the payments table.
          </p>
          <div className="mt-5 space-y-3">
            {overview.payments.map((payment) => (
              <div key={payment.payment_id} className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">
                  {payment.payment_id} • ${Number(payment.amount).toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {payment.booking_id} • {payment.payment_method} • {payment.payment_status}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold">Departures Today</h3>
          <p className="mt-1 text-sm text-slate-500">
            Loaded from reservations with today&apos;s check-out date.
          </p>
          <div className="mt-5 space-y-3">
            {overview.departures.length ? (
              overview.departures.map((departure) => (
                <div key={departure.booking_id} className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">
                    {departure.booking_id} • {departure.guest_name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {departure.room_name} • {departure.booking_status}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                No departures for today in the current seeded data.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">All Properties</h3>
            <p className="mt-1 text-sm text-slate-500">
              Full property list loaded from the backend properties endpoint.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={[
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
                propertiesConnected
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-slate-200 bg-slate-50 text-slate-600",
              ].join(" ")}
            >
              <span className="material-symbols-outlined text-base">
                {propertiesConnected ? "apartment" : "database"}
              </span>
              {propertiesLoading
                ? "Loading Properties"
                : propertiesConnected
                  ? `${properties.length} Properties Loaded`
                  : "Properties API Unavailable"}
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90">
              <span className="material-symbols-outlined text-base">add_business</span>
              Create Property
            </button>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="relative min-w-[260px] flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              search
            </span>
            <input
              type="text"
              value={propertySearch}
              onChange={(event) => setPropertySearch(event.target.value)}
              placeholder="Search by property ID, name, or type"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <p className="text-sm text-slate-500">
            Showing <span className="font-bold text-slate-900">{filteredProperties.length}</span> of{" "}
            <span className="font-bold text-slate-900">{properties.length}</span> properties
          </p>
        </div>

        {propertiesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="grid gap-4 md:grid-cols-[1.1fr_1.1fr_0.8fr_0.8fr]">
                  <div className="h-5 w-28 rounded bg-slate-200" />
                  <div className="h-5 w-40 rounded bg-slate-200" />
                  <div className="h-5 w-24 rounded bg-slate-200" />
                  <div className="h-5 w-28 rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProperties.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="hidden bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 md:grid md:grid-cols-[1fr_1.3fr_0.8fr_0.9fr_auto] md:gap-4">
              <span>Property ID</span>
              <span>Name</span>
              <span>Type</span>
              <span>Created</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-slate-200">
              {filteredProperties.map((property) => (
                <article
                  key={property.property_id}
                  className="grid gap-4 px-5 py-4 transition-colors hover:bg-slate-50 md:grid-cols-[1fr_1.3fr_0.8fr_0.9fr_auto] md:items-center"
                >
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Property ID
                    </p>
                    <p className="font-semibold text-slate-900">{property.property_id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Name
                    </p>
                    <p className="font-semibold text-slate-900">{property.name}</p>
                    <p className="text-sm text-slate-500">{property.name_lang || property.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Type
                    </p>
                    <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                      {formatPropertyType(property.property_type)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Created
                    </p>
                    <p className="text-sm font-medium text-slate-700">
                      {formatTimestamp(property.created_at)}
                    </p>
                  </div>
                  <div className="flex justify-start md:justify-end">
                    <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary">
                      <span className="material-symbols-outlined text-base">visibility</span>
                      View
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
            <span className="material-symbols-outlined text-3xl text-slate-400">
              holiday_village
            </span>
            <p className="mt-3 text-base font-semibold text-slate-900">
              {properties.length ? "No matching properties" : "No properties found"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {properties.length
                ? "Try a different search term to find the property you want."
                : "The dashboard could not find any property records to show here."}
            </p>
          </div>
        )}
      </section>
    </PmsShell>
  );
}
