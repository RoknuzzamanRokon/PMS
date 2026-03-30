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
      <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Dashboard page is under development.
        </h3>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          This section will be available later.
        </p>
      </section>
    </PmsShell>
  );
}
