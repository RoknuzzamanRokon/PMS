"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PmsShell } from "./pms-shell";
import { fetchJson } from "../lib/api";

const propertyTypeOptions = ["HOTEL", "RESORT", "APARTMENT", "VILLA", "HOSTEL"];

const propertyTypeLabels = {
  HOTEL: "Hotel",
  RESORT: "Resort",
  APARTMENT: "Apartment",
  VILLA: "Villa",
  HOSTEL: "Hostel",
};

const emptyForm = {
  name: "",
  name_lang: "",
  property_type: "HOTEL",
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

export function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [apiConnected, setApiConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function loadProperties(showRefreshing = false) {
    if (showRefreshing) {
      setRefreshing(true);
    }

    try {
      const data = await fetchJson("/properties");
      setProperties(Array.isArray(data) ? data : []);
      setApiConnected(true);
    } catch {
      setProperties([]);
      setApiConnected(false);
    } finally {
      setLoading(false);
      if (showRefreshing) {
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    loadProperties();
  }, []);

  const filteredProperties = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return properties;
    }

    return properties.filter((property) =>
      [property.property_id, property.name, property.name_lang, property.property_type]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [properties, search]);

  const propertyTypeCount = useMemo(
    () => new Set(properties.map((property) => property.property_type).filter(Boolean)).size,
    [properties],
  );

  const latestProperty = properties[0];

  async function handleCreateProperty(event) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");

    try {
      const payload = {
        name: form.name.trim(),
        name_lang: form.name_lang.trim() || form.name.trim(),
        property_type: form.property_type,
      };

      const createdProperty = await fetchJson("/properties", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setProperties((current) => [createdProperty, ...current]);
      setApiConnected(true);
      setForm(emptyForm);
      setShowCreateForm(false);
    } catch (error) {
      setSubmitError(error.message || "Could not create property.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PmsShell
      searchPlaceholder="Search properties, rooms, rates..."
      sidebarMetricLabel="Properties"
      sidebarMetricValue={`${properties.length}`}
      sidebarMetricProgress={Math.max(20, Math.min(100, properties.length * 12))}
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <span className="material-symbols-outlined text-base">apartment</span>
            Property Workspace
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Property Management</h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Manage the property list and jump into property actions for rooms, inventory,
            and daily rates from one place.
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
          {apiConnected ? "Properties API Live" : "Using Local Fallback"}
        </div>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "Total Properties",
            "domain",
            String(properties.length),
            "Loaded from `/api/v1/properties`.",
            "primary",
          ],
          [
            "Property Types",
            "category",
            String(propertyTypeCount),
            "Distinct property categories in the current list.",
            "blue",
          ],
          [
            "Latest Added",
            "schedule",
            latestProperty ? latestProperty.property_id : "N/A",
            latestProperty ? latestProperty.name : "No property records available.",
            "emerald",
          ],
          [
            "Search Results",
            "manage_search",
            String(filteredProperties.length),
            "Filtered count based on your current search.",
            "amber",
          ],
        ].map(([title, icon, value, note, tone]) => (
          <article
            key={title}
            className={[
              "rounded-xl bg-white p-5 shadow-sm dark:bg-slate-900/80",
              tone === "emerald" && "border border-emerald-200",
              tone === "blue" && "border border-blue-200",
              tone === "amber" && "border border-amber-200",
              tone === "primary" && "border border-slate-200 dark:border-slate-700",
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
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{note}</p>
          </article>
        ))}
      </section>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">Property Actions</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Create a new property, refresh the feed, or jump to operational modules.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowCreateForm((current) => !current)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined text-base">add_business</span>
              {showCreateForm ? "Close Form" : "Create Property"}
            </button>
            <button
              type="button"
              onClick={() => loadProperties(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
            >
              <span className="material-symbols-outlined text-base">
                {refreshing ? "sync" : "refresh"}
              </span>
              {refreshing ? "Refreshing..." : "Refresh List"}
            </button>
          </div>
        </div>

        {showCreateForm ? (
          <form
            onSubmit={handleCreateProperty}
            className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/70"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Property Name
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="City View Hotel"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Display Name
                <input
                  type="text"
                  value={form.name_lang}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name_lang: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="City View Hotel"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Property Type
                <select
                  value={form.property_type}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, property_type: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {propertyTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {formatPropertyType(type)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {submitError ? (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {submitError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setForm(emptyForm);
                  setShowCreateForm(false);
                  setSubmitError("");
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-70"
              >
                <span className="material-symbols-outlined text-base">save</span>
                {submitting ? "Creating..." : "Save Property"}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">Properties List</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Search the property feed and open related property actions.
            </p>
          </div>
          <label className="relative w-full max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by property ID, name, or type"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </label>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/70"
              >
                <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr_0.7fr_0.8fr_1.4fr]">
                  <div className="h-5 w-24 rounded bg-slate-200" />
                  <div className="h-5 w-40 rounded bg-slate-200" />
                  <div className="h-5 w-24 rounded bg-slate-200" />
                  <div className="h-5 w-24 rounded bg-slate-200" />
                  <div className="h-5 w-full rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProperties.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="hidden bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800/70 dark:text-slate-400 md:grid md:grid-cols-[0.9fr_1.1fr_0.7fr_0.8fr_1.4fr] md:gap-4">
              <span>Property ID</span>
              <span>Name</span>
              <span>Type</span>
              <span>Created</span>
              <span>Actions</span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredProperties.map((property) => (
                <article
                  key={property.property_id}
                  className="grid gap-4 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 md:grid-cols-[0.9fr_1.1fr_0.7fr_0.8fr_1.4fr] md:items-center"
                >
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Property ID
                    </p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{property.property_id}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Name
                    </p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{property.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{property.name_lang || property.name}</p>
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
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {formatTimestamp(property.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Actions
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/rooms-management?property_id=${property.property_id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                      >
                        <span className="material-symbols-outlined text-base">bed</span>
                        Rooms
                      </Link>
                      <Link
                        href={`/inventory?property_id=${property.property_id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                      >
                        <span className="material-symbols-outlined text-base">calendar_month</span>
                        Inventory
                      </Link>
                      <Link
                        href={`/daily-rates?property_id=${property.property_id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                      >
                        <span className="material-symbols-outlined text-base">sell</span>
                        Rates
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-800/70">
            <span className="material-symbols-outlined text-3xl text-slate-400">
              holiday_village
            </span>
            <p className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              {properties.length ? "No matching properties" : "No properties found"}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {properties.length
                ? "Try a different search term to find the property you want."
                : "Create your first property to start managing rooms, inventory, and rates."}
            </p>
          </div>
        )}
      </section>
    </PmsShell>
  );
}
