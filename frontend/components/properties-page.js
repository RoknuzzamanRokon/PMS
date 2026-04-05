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

function formatNumericValue(value, fallback = "0") {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("en-US") : fallback;
}

function formatCurrencyValue(value, currency = "USD") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return `${currency} 0.00`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [apiConnected, setApiConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [propertySort, setPropertySort] = useState("created-desc");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreatePropertyModal, setShowCreatePropertyModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPropertyDetail, setSelectedPropertyDetail] = useState(null);
  const [loadingPropertyDetail, setLoadingPropertyDetail] = useState(false);
  const [propertyDetailError, setPropertyDetailError] = useState("");
  const [showRoomsSummaryModal, setShowRoomsSummaryModal] = useState(false);
  const [propertyRooms, setPropertyRooms] = useState([]);
  const [loadingPropertyRooms, setLoadingPropertyRooms] = useState(false);
  const [propertyRoomsError, setPropertyRoomsError] = useState("");
  const [showRatePlansSummaryModal, setShowRatePlansSummaryModal] = useState(false);

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

  const sortedProperties = useMemo(() => {
    const items = [...filteredProperties];

    items.sort((left, right) => {
      if (propertySort === "name-asc") {
        return String(left.name || left.property_id).localeCompare(
          String(right.name || right.property_id),
        );
      }

      if (propertySort === "name-desc") {
        return String(right.name || right.property_id).localeCompare(
          String(left.name || left.property_id),
        );
      }

      const leftTime = new Date(left.created_at || 0).getTime();
      const rightTime = new Date(right.created_at || 0).getTime();

      if (propertySort === "created-asc") {
        return leftTime - rightTime;
      }

      return rightTime - leftTime;
    });

    return items;
  }, [filteredProperties, propertySort]);

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
      setShowCreatePropertyModal(false);
    } catch (error) {
      setSubmitError(error.message || "Could not create property.");
    } finally {
      setSubmitting(false);
    }
  }

  function openCreatePropertyModal() {
    setForm(emptyForm);
    setSubmitError("");
    setShowCreatePropertyModal(true);
  }

  function closeCreatePropertyModal() {
    setForm(emptyForm);
    setSubmitError("");
    setShowCreatePropertyModal(false);
  }

  async function handleViewProperty(propertyId) {
    setShowDetailsModal(true);
    setLoadingPropertyDetail(true);
    setPropertyDetailError("");
    setSelectedPropertyDetail(null);

    try {
      const detail = await fetchJson(`/properties/${encodeURIComponent(propertyId)}`);
      setSelectedPropertyDetail(detail);
    } catch (error) {
      setPropertyDetailError(error.message || "Could not load property details.");
    } finally {
      setLoadingPropertyDetail(false);
    }
  }

  function closeDetailsModal() {
    setShowDetailsModal(false);
    setSelectedPropertyDetail(null);
    setPropertyDetailError("");
    setLoadingPropertyDetail(false);
    closeRoomsSummaryModal();
    closeRatePlansSummaryModal();
  }

  async function openRoomsSummaryModal() {
    const propertyId = selectedPropertyDetail?.property_id;
    if (!propertyId) {
      return;
    }

    setShowRoomsSummaryModal(true);
    setLoadingPropertyRooms(true);
    setPropertyRoomsError("");
    setPropertyRooms([]);

    try {
      const rooms = await fetchJson(`/rooms?property_id=${encodeURIComponent(propertyId)}`);
      setPropertyRooms(Array.isArray(rooms) ? rooms : []);
    } catch (error) {
      setPropertyRoomsError(error.message || "Could not load room summary.");
    } finally {
      setLoadingPropertyRooms(false);
    }
  }

  function closeRoomsSummaryModal() {
    setShowRoomsSummaryModal(false);
    setPropertyRooms([]);
    setPropertyRoomsError("");
    setLoadingPropertyRooms(false);
  }

  function openRatePlansSummaryModal() {
    if (!selectedPropertyDetail?.property_id) {
      return;
    }

    setShowRatePlansSummaryModal(true);
  }

  function closeRatePlansSummaryModal() {
    setShowRatePlansSummaryModal(false);
  }

  const roomStatusSummary = useMemo(
    () =>
      propertyRooms.reduce((summary, room) => {
        const status = (room.room_status || "PROCESSING").toUpperCase();
        summary[status] = (summary[status] || 0) + 1;
        return summary;
      }, {}),
    [propertyRooms],
  );

  const averageRoomBaseRate = useMemo(() => {
    if (!propertyRooms.length) {
      return 0;
    }

    const total = propertyRooms.reduce((sum, room) => sum + Number(room.base_rate || 0), 0);
    return total / propertyRooms.length;
  }, [propertyRooms]);

  const propertyRatePlans = useMemo(
    () =>
      (selectedPropertyDetail?.rooms || []).flatMap((room) =>
        (room.rate_plans || []).map((plan) => ({
          ...plan,
          room_id: room.room_id,
          room_name: room.room_name,
          room_name_lang: room.room_name_lang,
        })),
      ),
    [selectedPropertyDetail],
  );

  const propertyRatePlanSummary = useMemo(() => {
    const activeCount = propertyRatePlans.filter((plan) => Boolean(plan.status)).length;
    const inactiveCount = propertyRatePlans.length - activeCount;
    const supplierCount = new Set(
      propertyRatePlans.map((plan) => plan.supplier_name).filter(Boolean),
    ).size;
    const averageCurrentRate = propertyRatePlans.length
      ? propertyRatePlans.reduce((sum, plan) => sum + Number(plan.current_rate || 0), 0) /
        propertyRatePlans.length
      : 0;

    return {
      total: propertyRatePlans.length,
      activeCount,
      inactiveCount,
      supplierCount,
      averageCurrentRate,
    };
  }, [propertyRatePlans]);

  return (
    <PmsShell
      searchPlaceholder="Search properties, rooms, rates..."
      sidebarMetricLabel="Properties"
      sidebarMetricValue={`${properties.length}`}
      sidebarMetricProgress={Math.max(
        20,
        Math.min(100, properties.length * 12),
      )}
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <span className="material-symbols-outlined text-base">
              apartment
            </span>
            Property Workspace
          </div>
          <h2 className="text-3xl font-bold tracking-tight">
            Property Management
          </h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Manage the property list and jump into property actions for rooms,
            inventory, and daily rates from one place.
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

      <section className="rounded-2xl border border-slate-200 bg-transparent p-6 shadow-sm dark:border-slate-700 dark:bg-transparent">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">Properties List</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Search the property feed and open related property actions.
            </p>
          </div>
          <div className="flex w-full max-w-xl flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={openCreatePropertyModal}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined text-base">add_business</span>
              Create Property
            </button>
            <label className="relative min-w-[260px] flex-1">
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
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Sort
              </span>
              <select
                value={propertySort}
                onChange={(event) => setPropertySort(event.target.value)}
                className="bg-transparent text-sm font-medium text-slate-700 outline-none dark:text-slate-200"
              >
                <option value="created-desc">Newest</option>
                <option value="created-asc">Oldest</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
              </select>
            </label>
          </div>
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
        ) : sortedProperties.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-transparent backdrop-blur-md dark:border-slate-700 dark:bg-transparent">
            <div className="hidden bg-white/30 px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-900/30 dark:text-slate-400 md:grid md:grid-cols-[0.9fr_1.1fr_0.7fr_0.8fr_1.4fr] md:gap-4">
              <span>Property ID</span>
              <span>Name</span>
              <span>Type</span>
              <span>Created</span>
              <span>Actions</span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {sortedProperties.map((property) => (
                <article
                  key={property.property_id}
                  className="grid gap-4 px-5 py-4 transition-colors hover:bg-white/30 dark:hover:bg-slate-900/30 md:grid-cols-[0.9fr_1.1fr_0.7fr_0.8fr_1.4fr] md:items-center"
                >
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Property ID
                    </p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {property.property_id}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:hidden">
                      Name
                    </p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {property.name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {property.name_lang || property.name}
                    </p>
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
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewProperty(property.property_id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                      >
                        <span className="material-symbols-outlined text-base">
                          visibility
                        </span>
                        Views
                      </button>
                      <span
                        className="h-6 w-px bg-slate-300 dark:bg-slate-600"
                        aria-hidden="true"
                      />
                      <Link
                        href={`/rooms-management?property_id=${property.property_id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                      >
                        <span className="material-symbols-outlined text-base">
                          bed
                        </span>
                        Rooms
                      </Link>
                      <span
                        className="h-6 w-px bg-slate-300 dark:bg-slate-600"
                        aria-hidden="true"
                      />
                      <Link
                        href={`/daily-rates?property_id=${property.property_id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                      >
                        <span className="material-symbols-outlined text-base">
                          sell
                        </span>
                        Rates
                      </Link>
                      <span
                        className="h-6 w-px bg-slate-300 dark:bg-slate-600"
                        aria-hidden="true"
                      />
                      <Link
                        href={`/inventory?property_id=${property.property_id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                      >
                        <span className="material-symbols-outlined text-base">
                          calendar_month
                        </span>
                        Inventory
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
              {properties.length
                ? "No matching properties"
                : "No properties found"}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {properties.length
                ? "Try a different search term to find the property you want."
                : "Create your first property to start managing rooms, inventory, and rates."}
            </p>
          </div>
        )}
      </section>

      {showCreatePropertyModal ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  Create Property
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Add New Property
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Create a property directly from the Properties List section.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreatePropertyModal}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateProperty} className="mt-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Property Name
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
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
                      setForm((current) => ({
                        ...current,
                        name_lang: event.target.value,
                      }))
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
                      setForm((current) => ({
                        ...current,
                        property_type: event.target.value,
                      }))
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

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCreatePropertyModal}
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
          </div>
        </div>
      ) : null}

      {showDetailsModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900/95">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  Property Details
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {selectedPropertyDetail?.name || "Loading property"}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedPropertyDetail?.property_id ||
                    "Fetching full property data from the API."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetailsModal}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {loadingPropertyDetail ? (
              <div className="mt-6 space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70"
                  />
                ))}
              </div>
            ) : propertyDetailError ? (
              <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {propertyDetailError}
              </p>
            ) : selectedPropertyDetail ? (
              <div className="mt-6 space-y-6">
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    [
                      "Property Type",
                      formatPropertyType(selectedPropertyDetail.property_type),
                    ],
                    [
                      "Total Rooms",
                      formatNumericValue(
                        selectedPropertyDetail.summary?.total_rooms,
                      ),
                    ],
                    [
                      "Rate Plans",
                      formatNumericValue(
                        selectedPropertyDetail.summary?.total_rate_plans,
                      ),
                    ],
                    [
                      "Inventory",
                      `${formatNumericValue(selectedPropertyDetail.summary?.available_inventory)} available / ${formatNumericValue(selectedPropertyDetail.summary?.total_inventory)} total`,
                    ],
                  ].map(([label, value]) => (
                    <article
                      key={label}
                      role={
                        label === "Total Rooms" || label === "Rate Plans"
                          ? "button"
                          : undefined
                      }
                      tabIndex={
                        label === "Total Rooms" || label === "Rate Plans"
                          ? 0
                          : undefined
                      }
                      onClick={
                        label === "Total Rooms"
                          ? openRoomsSummaryModal
                          : label === "Rate Plans"
                            ? openRatePlansSummaryModal
                            : undefined
                      }
                      onKeyDown={
                        label === "Total Rooms" || label === "Rate Plans"
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                if (label === "Total Rooms") {
                                  openRoomsSummaryModal();
                                } else {
                                  openRatePlansSummaryModal();
                                }
                              }
                            }
                          : undefined
                      }
                      className={[
                        "rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70",
                        label === "Total Rooms" || label === "Rate Plans"
                          ? "cursor-pointer transition hover:border-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          {label}
                        </p>
                        {label === "Total Rooms" || label === "Rate Plans" ? (
                          <span className="material-symbols-outlined text-base text-primary">
                            open_in_new
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                        {value}
                      </p>
                      {label === "Total Rooms" || label === "Rate Plans" ? (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          {label === "Total Rooms"
                            ? "Click to open room-only summary."
                            : "Click to open rate-plan summary."}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </section>

                {/* <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Summary
                    </h4>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {[
                        [
                          "Average Base Rate",
                          formatCurrencyValue(
                            selectedPropertyDetail.summary?.average_base_rate,
                          ),
                        ],
                        [
                          "Average Current Rate",
                          formatCurrencyValue(
                            selectedPropertyDetail.summary
                              ?.average_current_rate,
                          ),
                        ],
                        [
                          "Sold Inventory",
                          formatNumericValue(
                            selectedPropertyDetail.summary?.sold_inventory,
                          ),
                        ],
                        [
                          "Blocked Inventory",
                          formatNumericValue(
                            selectedPropertyDetail.summary?.blocked_inventory,
                          ),
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60"
                        >
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {label}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                    <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Readiness
                    </h4>
                    <div className="mt-4 space-y-3">
                      {[
                        [
                          "Base Image",
                          selectedPropertyDetail.property_base_image,
                        ],
                        ["Amenities", selectedPropertyDetail.amenities],
                        ["Facilities", selectedPropertyDetail.facilities],
                      ].map(([label, info]) => (
                        <div
                          key={label}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60"
                        >
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            {label}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {info?.available
                              ? "Available"
                              : info?.message || "Coming soon"}
                          </p>
                          {info?.url ? (
                            <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                              {info.url}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </article>
                </section> */}

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Rooms
                      </h4>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Full property room inventory and linked rate plans.
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {selectedPropertyDetail.rooms?.length || 0} rooms
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {(selectedPropertyDetail.rooms || []).map((room) => (
                      <article
                        key={room.room_id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h5 className="text-base font-bold text-slate-900 dark:text-slate-100">
                              {room.room_name}
                            </h5>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              {[
                                room.room_id,
                                room.room_name_lang || room.room_name,
                                room.status,
                              ]
                                .filter(Boolean)
                                .join(" • ")}
                            </p>
                          </div>
                          <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700 shadow-sm dark:bg-emerald-500/15 dark:text-emerald-300">
                            {room.active_rate_plan_count} active plans
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          {[
                            ["Base Rate", formatCurrencyValue(room.base_rate)],
                            [
                              "Current Rate",
                              formatCurrencyValue(room.current_rate),
                            ],
                            [
                              "Inventory",
                              `${formatNumericValue(room.available_inventory)} / ${formatNumericValue(room.total_inventory)}`,
                            ],
                            ["Sold", formatNumericValue(room.sold_inventory)],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/80"
                            >
                              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                {label}
                              </p>
                              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Rate Plans
                          </p>
                          {(room.rate_plans || []).length ? (
                            <div className="mt-3 space-y-3">
                              {room.rate_plans.map((plan) => (
                                <div
                                  key={plan.rate_id}
                                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/80"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                        {plan.title}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {[
                                          plan.rate_id,
                                          plan.supplier_name || "No supplier",
                                          plan.currency,
                                        ]
                                          .filter(Boolean)
                                          .join(" • ")}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                        {formatCurrencyValue(
                                          plan.current_rate,
                                          plan.currency || "USD",
                                        )}
                                      </p>
                                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        Base{" "}
                                        {formatCurrencyValue(
                                          plan.base_rate,
                                          plan.currency || "USD",
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">
                              No rate plans linked to this room yet.
                            </p>
                          )}
                        </div>
                      </article>
                    ))}

                    {!selectedPropertyDetail.rooms?.length ? (
                      <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                        No room details returned for this property.
                      </p>
                    ) : null}
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showRoomsSummaryModal ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900/95">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  Room Summary
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {selectedPropertyDetail?.name || "Selected Property"}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedPropertyDetail?.property_id ||
                    "Property not selected"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/rooms-management?property_id=${selectedPropertyDetail?.property_id || ""}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
                >
                  <span className="material-symbols-outlined text-base">
                    add
                  </span>
                  Create New Rooms
                </Link>
                <button
                  type="button"
                  onClick={closeRoomsSummaryModal}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {loadingPropertyRooms ? (
              <div className="mt-6 space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70"
                  />
                ))}
              </div>
            ) : propertyRoomsError ? (
              <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {propertyRoomsError}
              </p>
            ) : (
              <div className="mt-6 space-y-6">
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Total Rooms", formatNumericValue(propertyRooms.length)],
                    [
                      "Average Base Rate",
                      formatCurrencyValue(averageRoomBaseRate),
                    ],
                    ["Latest Room Added", propertyRooms[0]?.room_id || "N/A"],
                    ["Property", selectedPropertyDetail?.property_id || "N/A"],
                  ].map(([label, value]) => (
                    <article
                      key={label}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70"
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {label}
                      </p>
                      <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                        {value}
                      </p>
                    </article>
                  ))}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Status Breakdown
                      </h4>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Live summary from `/api/v1/rooms?property_id=
                        {selectedPropertyDetail?.property_id}`.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(roomStatusSummary).length ? (
                        Object.entries(roomStatusSummary).map(
                          ([status, count]) => (
                            <span
                              key={status}
                              className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              {status.toLowerCase().replaceAll("_", " ")}:{" "}
                              {count}
                            </span>
                          ),
                        )
                      ) : (
                        <span className="inline-flex rounded-full border border-dashed border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                          No rooms found
                        </span>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Room List
                      </h4>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Room details fetched only for this property.
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {propertyRooms.length} rooms
                    </div>
                  </div>

                  {propertyRooms.length ? (
                    <div className="mt-5 space-y-3">
                      {propertyRooms.map((room) => (
                        <article
                          key={room.room_id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h5 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                {room.room_name}
                              </h5>
                              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {[
                                  room.room_id,
                                  room.room_name_lang || room.room_name,
                                  room.property_id,
                                ]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </p>
                            </div>
                            <div
                              className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-900 shadow-sm"
                              style={
                                String(room.room_status || "PROCESSING").toUpperCase() === "LIVE"
                                  ? { backgroundColor: "#3adb12" }
                                  : String(room.room_status || "PROCESSING").toUpperCase() === "PROCESSING"
                                    ? { backgroundColor: "#e8e22a" }
                                    : { backgroundColor: "#e2e8f0" }
                              }
                            >
                              {(room.room_status || "PROCESSING")
                                .toLowerCase()
                                .replaceAll("_", " ")}
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {[
                              [
                                "Base Rate",
                                formatCurrencyValue(room.base_rate),
                              ],
                              [
                                "Tax & Service",
                                formatCurrencyValue(room.tax_and_service_fee),
                              ],
                              [
                                "Surcharges",
                                formatCurrencyValue(room.surcharges),
                              ],
                              [
                                "Mandatory Tax",
                                formatCurrencyValue(room.mandatory_tax),
                              ],
                            ].map(([label, value]) => (
                              <div
                                key={label}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/80"
                              >
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                  {label}
                                </p>
                                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                      No rooms found for this property yet. Use the create
                      button to add one.
                    </p>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {showRatePlansSummaryModal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900/95">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  Rate Plan Summary
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {selectedPropertyDetail?.name || "Selected Property"}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedPropertyDetail?.property_id ||
                    "Property not selected"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/daily-rates?property_id=${selectedPropertyDetail?.property_id || ""}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
                >
                  <span className="material-symbols-outlined text-base">
                    add
                  </span>
                  Create Rate Plan
                </Link>
                <button
                  type="button"
                  onClick={closeRatePlansSummaryModal}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  [
                    "Total Rate Plans",
                    formatNumericValue(propertyRatePlanSummary.total),
                  ],
                  [
                    "Active Plans",
                    formatNumericValue(propertyRatePlanSummary.activeCount),
                  ],
                  [
                    "Suppliers",
                    formatNumericValue(propertyRatePlanSummary.supplierCount),
                  ],
                  [
                    "Average Current Rate",
                    formatCurrencyValue(
                      propertyRatePlanSummary.averageCurrentRate,
                    ),
                  ],
                ].map(([label, value]) => (
                  <article
                    key={label}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70"
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {label}
                    </p>
                    <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                      {value}
                    </p>
                  </article>
                ))}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Plan Status
                    </h4>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Combined summary for all room rate plans in this property.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
                      active: {propertyRatePlanSummary.activeCount}
                    </span>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      inactive: {propertyRatePlanSummary.inactiveCount}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Rate Plan List
                    </h4>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      All rate plans from every room in this property.
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {propertyRatePlanSummary.total} rate plans
                  </div>
                </div>

                {propertyRatePlans.length ? (
                  <div className="mt-5 space-y-3">
                    {propertyRatePlans.map((plan) => (
                      <article
                        key={plan.rate_id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h5 className="text-base font-bold text-slate-900 dark:text-slate-100">
                              {plan.title}
                            </h5>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              {[
                                plan.rate_id,
                                plan.room_name,
                                plan.supplier_name || "No supplier",
                              ]
                                .filter(Boolean)
                                .join(" • ")}
                            </p>
                          </div>
                          <div
                            className={[
                              "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-sm",
                              plan.status
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
                            ].join(" ")}
                          >
                            {plan.status ? "active" : "inactive"}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          {[
                            [
                              "Current Rate",
                              formatCurrencyValue(
                                plan.current_rate,
                                plan.currency || "USD",
                              ),
                            ],
                            [
                              "Base Rate",
                              formatCurrencyValue(
                                plan.base_rate,
                                plan.currency || "USD",
                              ),
                            ],
                            [
                              "Inventory",
                              `${formatNumericValue(plan.available_inventory)} / ${formatNumericValue(plan.total_inventory)}`,
                            ],
                            ["Sold", formatNumericValue(plan.sold_inventory)],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/80"
                            >
                              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                {label}
                              </p>
                              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                    No rate plans found for this property yet. Use the create
                    button to add one.
                  </p>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </PmsShell>
  );
}
