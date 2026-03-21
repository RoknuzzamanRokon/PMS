"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PmsShell } from "./pms-shell";
import { fetchJson } from "../lib/api";

const defaultPropertyId = "PROP001";

const fallbackData = {
  property: { property_id: defaultPropertyId, name: "Selected Property" },
  summary: {
    total_rooms: 5,
    available_inventory: 39,
    sold_inventory: 58,
    blocked_inventory: 2,
    occupancy_percent: 69.7,
  },
  categories: [],
  rooms: [],
};

function createRoomForm(propertyId) {
  return {
    property_id: propertyId,
    room_name: "",
    room_name_lang: "",
    base_rate: "240",
    tax_and_service_fee: "18",
    surcharges: "5",
    mandatory_fee: "3",
    resort_fee: "2",
    mandatory_tax: "7",
  };
}

function createImageForm() {
  return {
    room_name: "",
    image_url: "https://images.example.com/rooms/deluxe-suite.jpg",
    alt_text: "",
  };
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const completionChecklist = [
  { key: "details_ready", label: "Room details completed", icon: "checklist" },
  { key: "pricing_ready", label: "Pricing configured", icon: "sell" },
  { key: "inventory_ready", label: "Inventory linked", icon: "inventory_2" },
  { key: "images_ready", label: "Images prepared", icon: "image" },
  { key: "housekeeping_ready", label: "Housekeeping approved", icon: "cleaning_services" },
];

function createRoomLaunchStatus() {
  return {
    details_ready: false,
    pricing_ready: false,
    inventory_ready: false,
    images_ready: false,
    housekeeping_ready: false,
    sales_ready: false,
    sales_note: "",
    internal_note: "",
  };
}

function getCompletionSummary(status) {
  const completedCount = completionChecklist.filter((item) => status?.[item.key]).length;
  const totalCount = completionChecklist.length;
  const percent = Math.round((completedCount / totalCount) * 100);

  return {
    completedCount,
    totalCount,
    percent,
    canGoLive: completedCount === totalCount,
  };
}

export function RoomsManagementPage({ propertyId }) {
  const selectedPropertyId = propertyId || defaultPropertyId;
  const [activeManagementSection, setActiveManagementSection] = useState("add-room");
  const [data, setData] = useState(fallbackData);
  const [apiConnected, setApiConnected] = useState(false);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [roomForm, setRoomForm] = useState(() => createRoomForm(selectedPropertyId));
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomSubmitError, setRoomSubmitError] = useState("");
  const [roomSubmitSuccess, setRoomSubmitSuccess] = useState("");
  const [imageForm, setImageForm] = useState(createImageForm);
  const [imageDrafts, setImageDrafts] = useState([]);
  const [imageSubmitMessage, setImageSubmitMessage] = useState("");
  const [roomLaunchStatuses, setRoomLaunchStatuses] = useState({});
  const [activeRoomId, setActiveRoomId] = useState("");
  const [roomStatusMode, setRoomStatusMode] = useState("form");
  const propertyLocation = "Location info not available";
  const roomStatusStorageKey = `inno-rooms-room-launch-status:${selectedPropertyId}`;

  async function loadOverview() {
    setLoadingOverview(true);

    try {
      const overview = await fetchJson(
        `/rooms/overview?property_id=${encodeURIComponent(selectedPropertyId)}`,
      );
      setData(overview);
      setApiConnected(true);
    } catch {
      setApiConnected(false);
    } finally {
      setLoadingOverview(false);
    }
  }

  useEffect(() => {
    setRoomForm(createRoomForm(selectedPropertyId));
    setRoomSubmitError("");
    setRoomSubmitSuccess("");
    loadOverview();
  }, [selectedPropertyId]);

  useEffect(() => {
    try {
      const savedStatuses = window.localStorage.getItem(roomStatusStorageKey);
      setRoomLaunchStatuses(savedStatuses ? JSON.parse(savedStatuses) : {});
    } catch {
      setRoomLaunchStatuses({});
    }
    setActiveRoomId("");
    setRoomStatusMode("form");
  }, [roomStatusStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(roomStatusStorageKey, JSON.stringify(roomLaunchStatuses));
    } catch {}
  }, [roomLaunchStatuses, roomStatusStorageKey]);

  const summaryCards = useMemo(
    () => [
      ["Total Rooms", "meeting_room", String(data.summary.total_rooms), `${data.property.name} is synced from the backend property feed.`, "slate"],
      ["Available", "check_circle", String(data.summary.available_inventory), "Available inventory across linked rate plans.", "emerald"],
      ["Booked", "bedtime", String(data.summary.sold_inventory), "Sold inventory from current rate plan totals.", "blue"],
      ["Blocked", "block", String(data.summary.blocked_inventory), "Derived from CTA, CTD, or stop-sell flags.", "amber"],
      ["Occupancy", "bar_chart", `${data.summary.occupancy_percent}%`, "Calculated from sold versus total inventory.", "slate"],
    ],
    [data],
  );

  const activeCategory = useMemo(
    () => data.categories.find((category) => category.room_id === activeRoomId) || null,
    [activeRoomId, data.categories],
  );

  const activeLaunchStatus = activeCategory
    ? roomLaunchStatuses[activeCategory.room_id] || createRoomLaunchStatus()
    : null;

  const activeCompletionSummary = activeLaunchStatus
    ? getCompletionSummary(activeLaunchStatus)
    : null;

  async function handleCreateRoom(event) {
    event.preventDefault();
    setCreatingRoom(true);
    setRoomSubmitError("");
    setRoomSubmitSuccess("");

    try {
      const payload = {
        property_id: selectedPropertyId,
        room_name: roomForm.room_name.trim(),
        room_name_lang: roomForm.room_name_lang.trim() || roomForm.room_name.trim(),
        base_rate: numberValue(roomForm.base_rate),
        tax_and_service_fee: numberValue(roomForm.tax_and_service_fee),
        surcharges: numberValue(roomForm.surcharges),
        mandatory_fee: numberValue(roomForm.mandatory_fee),
        resort_fee: numberValue(roomForm.resort_fee),
        mandatory_tax: numberValue(roomForm.mandatory_tax),
      };

      await fetchJson("/rooms", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setRoomSubmitSuccess(`Room created for property ${selectedPropertyId}.`);
      setRoomForm(createRoomForm(selectedPropertyId));
      await loadOverview();
    } catch (error) {
      setRoomSubmitError(error.message || "Could not create room.");
    } finally {
      setCreatingRoom(false);
    }
  }

  function handleSaveImageDraft(event) {
    event.preventDefault();

    const nextDraft = {
      property_id: selectedPropertyId,
      room_name: imageForm.room_name.trim() || "Unnamed room",
      image_url: imageForm.image_url.trim() || "https://images.example.com/rooms/placeholder.jpg",
      alt_text: imageForm.alt_text.trim() || "Room image placeholder",
    };

    setImageDrafts((current) => [nextDraft, ...current]);
    setImageForm(createImageForm());
    setImageSubmitMessage(
      "Dummy image URL saved locally for now. Backend image upload is not connected yet.",
    );
  }

  function openRoomStatus(category) {
    const existingStatus = roomLaunchStatuses[category.room_id] || createRoomLaunchStatus();
    setRoomLaunchStatuses((current) => ({
      ...current,
      [category.room_id]: current[category.room_id] || existingStatus,
    }));
    setActiveRoomId(category.room_id);
    setRoomStatusMode(existingStatus.sales_ready ? "success" : "form");
  }

  function updateActiveRoomStatus(key, value) {
    if (!activeCategory) {
      return;
    }

    setRoomLaunchStatuses((current) => ({
      ...current,
      [activeCategory.room_id]: {
        ...(current[activeCategory.room_id] || createRoomLaunchStatus()),
        [key]: value,
      },
    }));
  }

  function handleGoLiveToggle(nextValue) {
    if (!activeCategory || !activeLaunchStatus) {
      return;
    }

    const completion = getCompletionSummary(activeLaunchStatus);
    if (nextValue && !completion.canGoLive) {
      return;
    }

    updateActiveRoomStatus("sales_ready", nextValue);
    setRoomStatusMode(nextValue ? "success" : "form");
  }

  return (
    <PmsShell
      searchPlaceholder="Search rooms or categories..."
      sidebarMetricLabel="Total Occupancy"
      sidebarMetricValue={`${data.summary.occupancy_percent}%`}
      sidebarMetricProgress={Math.max(10, Math.min(100, Math.round(data.summary.occupancy_percent)))}
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <span className="material-symbols-outlined text-base">hotel</span>
            Property + Room Type + Inventory
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Rooms Management</h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Summary cards, category panels, and room table below are all fed by
            {" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              /api/v1/rooms/overview?property_id={selectedPropertyId}
            </span>
            .
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
            {apiConnected ? "sync" : "cloud_off"}
          </span>
          {apiConnected ? "Rooms API Live" : "Using Local Fallback"}
        </div>
      </div>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              Selected Property
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{data.property.name}</h3>
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                <span className="material-symbols-outlined text-primary">badge</span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Property ID
                  </p>
                  <p className="font-semibold">{data.property.property_id}</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                <span className="material-symbols-outlined text-primary">location_on</span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Location
                  </p>
                  <p className="font-semibold">{propertyLocation}</p>
                </div>
              </div>
            </div>
          </div>
          <Link
            href="/properties"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Properties
          </Link>
        </div>
      </section>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map(([title, icon, value, note, tone]) => (
          <article
            key={title}
            className={[
              "rounded-xl bg-white p-5 shadow-sm dark:bg-slate-900/80",
              tone === "emerald" && "border border-emerald-200",
              tone === "blue" && "border border-blue-200",
              tone === "amber" && "border border-amber-200",
              tone === "slate" && "border border-slate-200 dark:border-slate-700",
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
                  tone === "slate" && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {icon}
              </span>
            </div>
            <p className="text-3xl font-bold">{value}</p>
            {title === "Occupancy" ? (
              <div className="mt-3 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${data.summary.occupancy_percent}%` }}
                />
              </div>
            ) : null}
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{note}</p>
          </article>
        ))}
      </section>

      <div className="mb-6">
        <div className="border-b border-gray-200 pb-3 dark:border-slate-700">
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            {[
              ["add-room", "Add Room"],
              ["room-image", "Room Image"],
              ["amenities", "Amenities"],
              ["more-sections", "More sections later"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveManagementSection(value)}
                className={[
                  "rounded-lg px-3 py-2 transition-colors",
                  activeManagementSection === value
                    ? "bg-primary text-white"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeManagementSection === "add-room" ? (
      <section className="mb-8">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold">Add Room</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                This card posts directly to <span className="font-medium text-slate-700 dark:text-slate-300">/api/v1/rooms</span> using the selected property.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Locked Property ID
              </p>
              <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                {selectedPropertyId}
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateRoom}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Property ID
                <input
                  type="text"
                  value={selectedPropertyId}
                  readOnly
                  className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Room Name
                <input
                  type="text"
                  required
                  value={roomForm.room_name}
                  onChange={(event) =>
                    setRoomForm((current) => ({ ...current, room_name: event.target.value }))
                  }
                  placeholder="Deluxe Suite"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Display Name
                <input
                  type="text"
                  value={roomForm.room_name_lang}
                  onChange={(event) =>
                    setRoomForm((current) => ({ ...current, room_name_lang: event.target.value }))
                  }
                  placeholder="Deluxe Suite"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Base Rate
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={roomForm.base_rate}
                  onChange={(event) =>
                    setRoomForm((current) => ({ ...current, base_rate: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Tax & Service Fee
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={roomForm.tax_and_service_fee}
                  onChange={(event) =>
                    setRoomForm((current) => ({ ...current, tax_and_service_fee: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Surcharges
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={roomForm.surcharges}
                  onChange={(event) =>
                    setRoomForm((current) => ({ ...current, surcharges: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Mandatory Fee
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={roomForm.mandatory_fee}
                  onChange={(event) =>
                    setRoomForm((current) => ({ ...current, mandatory_fee: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Resort Fee
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={roomForm.resort_fee}
                  onChange={(event) =>
                    setRoomForm((current) => ({ ...current, resort_fee: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Mandatory Tax
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={roomForm.mandatory_tax}
                  onChange={(event) =>
                    setRoomForm((current) => ({ ...current, mandatory_tax: event.target.value }))
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>
            </div>

            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/70">
                  <tr className="text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    <th className="px-4 py-3">Field</th>
                    <th className="px-4 py-3">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[
                    ["property_id", selectedPropertyId],
                    ["room_name", roomForm.room_name || "-"],
                    ["room_name_lang", roomForm.room_name_lang || roomForm.room_name || "-"],
                    ["base_rate", roomForm.base_rate || "0"],
                    ["tax_and_service_fee", roomForm.tax_and_service_fee || "0"],
                    ["surcharges", roomForm.surcharges || "0"],
                    ["mandatory_fee", roomForm.mandatory_fee || "0"],
                    ["resort_fee", roomForm.resort_fee || "0"],
                    ["mandatory_tax", roomForm.mandatory_tax || "0"],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                        {label}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {roomSubmitError ? (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {roomSubmitError}
              </p>
            ) : null}

            {roomSubmitSuccess ? (
              <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {roomSubmitSuccess}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={creatingRoom}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-base">
                  {creatingRoom ? "sync" : "add_home"}
                </span>
                {creatingRoom ? "Creating Room..." : "Create Room"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoomForm(createRoomForm(selectedPropertyId));
                  setRoomSubmitError("");
                  setRoomSubmitSuccess("");
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
              >
                <span className="material-symbols-outlined text-base">restart_alt</span>
                Reset
              </button>
            </div>
          </form>
        </article>
      </section>
      ) : null}

      {activeManagementSection === "room-image" ? (
      <section className="mb-8">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="mb-5">
            <h3 className="text-xl font-bold">Room Image Draft</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Image upload is not supported by the current backend room API, so this card keeps a dummy image URL ready for a future image endpoint.
            </p>
          </div>

          <form onSubmit={handleSaveImageDraft}>
            <div className="grid gap-4">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Property ID
                <input
                  type="text"
                  value={selectedPropertyId}
                  readOnly
                  className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Room Name
                <input
                  type="text"
                  value={imageForm.room_name}
                  onChange={(event) =>
                    setImageForm((current) => ({ ...current, room_name: event.target.value }))
                  }
                  placeholder="Deluxe Suite"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Dummy Image URL
                <input
                  type="url"
                  value={imageForm.image_url}
                  onChange={(event) =>
                    setImageForm((current) => ({ ...current, image_url: event.target.value }))
                  }
                  placeholder="https://images.example.com/rooms/deluxe-suite.jpg"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Alt Text
                <input
                  type="text"
                  value={imageForm.alt_text}
                  onChange={(event) =>
                    setImageForm((current) => ({ ...current, alt_text: event.target.value }))
                  }
                  placeholder="Deluxe Suite room image"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>
            </div>

            {imageSubmitMessage ? (
              <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                {imageSubmitMessage}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 dark:bg-slate-100 dark:text-slate-900"
              >
                <span className="material-symbols-outlined text-base">image</span>
                Save Dummy Image URL
              </button>
              <button
                type="button"
                onClick={() => {
                  setImageForm(createImageForm());
                  setImageSubmitMessage("");
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
              >
                <span className="material-symbols-outlined text-base">restart_alt</span>
                Reset
              </button>
            </div>
          </form>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Draft Image Records
              </p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {imageDrafts.length ? (
                imageDrafts.map((draft, index) => (
                  <div key={`${draft.property_id}-${draft.room_name}-${index}`} className="px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {draft.room_name}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                          {draft.property_id}
                        </p>
                      </div>
                      <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-700">
                        Draft Only
                      </span>
                    </div>
                    <p className="mt-3 break-all text-sm text-slate-600 dark:text-slate-300">
                      {draft.image_url}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {draft.alt_text}
                    </p>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
                  No image drafts yet. Add one dummy URL and we will keep it here until the backend supports room images.
                </div>
              )}
            </div>
          </div>
        </article>
      </section>
      ) : null}

      {activeManagementSection === "amenities" ? (
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="mb-4">
            <h3 className="text-xl font-bold">Amenities</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              This section is reserved for room amenities. We can add amenity fields and save flow here next.
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-800/70">
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Amenities section is ready for the next feature.
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Click another tab above to view only that section.
            </p>
          </div>
        </section>
      ) : null}

      {activeManagementSection === "more-sections" ? (
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="mb-4">
            <h3 className="text-xl font-bold">More Sections Later</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              This area is kept for future room modules like policies, beds, occupancy, and publishing controls.
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-800/70">
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Future room elements can be added here.
            </p>
          </div>
        </section>
      ) : null}

      <section className="mb-8 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold">Status Overview</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Real inventory and occupancy metrics from the backend overview feed.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/70">
              <p className="font-bold">Property</p>
              <p className="text-slate-500 dark:text-slate-400">{data.property.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                {selectedPropertyId}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">Inventory Mix</p>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  API totals
                </span>
              </div>
              <div className="space-y-3">
                {[
                  ["Available", `${data.summary.available_inventory} units`, "w-[55%]", "bg-emerald-500", "text-emerald-600"],
                  ["Booked", `${data.summary.sold_inventory} units`, "w-[35%]", "bg-blue-500", "text-blue-600"],
                  ["Blocked", `${data.summary.blocked_inventory} flags`, "w-[10%]", "bg-amber-500", "text-amber-600"],
                ].map(([label, value, width, color, text]) => (
                  <div key={label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-500 dark:text-slate-400">{label}</span>
                      <span className={`font-bold ${text}`}>{value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-full rounded-full ${width} ${color}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold">Operational Feed</p>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                  Live
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Property ID", data.property.property_id],
                  ["Categories", `${data.categories.length}`],
                  ["Room Rows", `${data.rooms.length}`],
                  ["Endpoint", `/api/v1/rooms/overview?property_id=${selectedPropertyId}`],
                ].map(([label, text]) => (
                  <div key={label} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
                    <p className="font-semibold">{label}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="mb-4">
            <h3 className="text-xl font-bold">Room Categories</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Built from backend room and rate-plan relations.
            </p>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
              <span className="material-symbols-outlined text-base">pin_drop</span>
              Viewing {data.property.name}
            </div>
          </div>
          <div className="space-y-3">
            {data.categories.map((category) => (
              <button
                key={category.room_id}
                type="button"
                onClick={() => openRoomStatus(category)}
                className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-primary hover:shadow-sm dark:border-slate-700"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{category.room_name}</p>
                      {(roomLaunchStatuses[category.room_id]?.sales_ready) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          <span className="material-symbols-outlined text-xs">check_circle</span>
                          Live
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {category.room_id} • {category.rate_plan_count} rate plans
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      Active
                    </span>
                    <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {getCompletionSummary(
                        roomLaunchStatuses[category.room_id] || createRoomLaunchStatus(),
                      ).percent}% complete
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                    Base Rate: ${Number(category.base_rate).toFixed(2)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                    Available: {category.available_inventory}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                    Sold: {category.sold_inventory}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                    Click to manage go-live status
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeCategory && activeLaunchStatus && activeCompletionSummary ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-sm sm:p-4">
          <div className="flex min-h-full items-center justify-center">
          <div className="my-4 w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            {activeLaunchStatus.sales_ready && roomStatusMode === "success" ? (
              <div className="px-4 py-10 sm:px-6 sm:py-14">
                <div className="mx-auto max-w-lg text-center">
                  <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                  </div>
                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                    {activeCompletionSummary.percent === 100 ? "Done" : "Processing"}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {activeCompletionSummary.percent === 100
                      ? "Room is live successfully"
                      : `Processing ${activeCompletionSummary.percent}% complete`}
                  </h3>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    {activeCompletionSummary.percent === 100
                      ? `${activeCategory.room_name} is now marked live for sale for ${data.property.name}.`
                      : `${activeCategory.room_name} is still being prepared for ${data.property.name}.`}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setRoomStatusMode("form")}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveRoomId("");
                        setRoomStatusMode("form");
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
                    >
                      <span className="material-symbols-outlined text-base">close</span>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-6 sm:py-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                      Room Complete Status
                    </p>
                    <h3 className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
                      {activeCategory.room_name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {activeCategory.room_id} for {data.property.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoomId("");
                      setRoomStatusMode("form");
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                    Close
                  </button>
                </div>

                <div className="max-h-[calc(100vh-7rem)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="min-w-0">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Completion Progress
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Finish all required items before the room goes live for sale.
                      </p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-sm font-bold text-primary dark:bg-slate-900">
                      {activeCompletionSummary.completedCount}/{activeCompletionSummary.totalCount}
                    </div>
                  </div>
                  <div className="mt-4 h-3 rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${activeCompletionSummary.percent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {completionChecklist.map((item) => (
                    <label
                      key={item.key}
                      className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-4 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined rounded-xl bg-primary/10 p-2 text-primary">
                          {item.icon}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {item.label}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Update this when the room is ready in that area.
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(activeLaunchStatus[item.key])}
                        onChange={(event) => updateActiveRoomStatus(item.key, event.target.checked)}
                        className="size-5 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="min-w-0">
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Room Information
                  </h4>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    {[
                      ["Room", activeCategory.room_name],
                      ["Room ID", activeCategory.room_id],
                      ["Base Rate", `$${Number(activeCategory.base_rate).toFixed(2)}`],
                      ["Rate Plans", `${activeCategory.rate_plan_count}`],
                      ["Available", `${activeCategory.available_inventory}`],
                      ["Sold", `${activeCategory.sold_inventory}`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                          {label}
                        </p>
                        <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Go Live For Sale
                  </h4>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    This is currently saved only in the browser. There is no backend update API for room launch status yet.
                  </p>

                  <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          Sales Status
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {activeLaunchStatus.sales_ready
                            ? "This room is marked live for sale."
                            : activeCompletionSummary.canGoLive
                              ? "All checks are complete. You can mark this room live now."
                              : "Complete every checklist item to enable go live."}
                        </p>
                      </div>
                      <span
                        className={[
                          "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider",
                          activeLaunchStatus.sales_ready
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700",
                        ].join(" ")}
                      >
                        {activeLaunchStatus.sales_ready ? "Live" : "Pending"}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={!activeCompletionSummary.canGoLive}
                        onClick={() => handleGoLiveToggle(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-base">published_with_changes</span>
                        Mark Live
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGoLiveToggle(false)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                      >
                        <span className="material-symbols-outlined text-base">pause_circle</span>
                        Hold From Sale
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      Sales Note
                      <textarea
                        value={activeLaunchStatus.sales_note}
                        onChange={(event) => updateActiveRoomStatus("sales_note", event.target.value)}
                        rows={3}
                        placeholder="Ready for OTA and direct channel publishing."
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      Internal Note
                      <textarea
                        value={activeLaunchStatus.internal_note}
                        onChange={(event) => updateActiveRoomStatus("internal_note", event.target.value)}
                        rows={4}
                        placeholder="Add housekeeping, pricing, or setup notes for the team."
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
                </div>
              </>
            )}
          </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">Room Inventory Table</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Directly rendered from the room overview response.
            </p>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {loadingOverview ? "Refreshing room table..." : `${data.rooms.length} rows loaded`}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-3">Room</th>
                <th className="pb-3">Property</th>
                <th className="pb-3">Base Rate</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Housekeeping</th>
                <th className="pb-3">Notes</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.rooms.map((row) => (
                <tr key={row.room_id}>
                  {[row.room_id, row.property_id, `$${Number(row.base_rate).toFixed(2)}`, row.status, row.housekeeping_status, row.note].map(
                    (cell, index) => (
                      <td
                        key={`${row.room_id}-${index}`}
                        className="py-4 pr-4 text-slate-600 first:font-bold first:text-slate-900 dark:text-slate-300 dark:first:text-slate-100"
                      >
                        {cell}
                      </td>
                    ),
                  )}
                  <td className="py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const category = data.categories.find(
                            (item) => item.room_id === row.room_id,
                          );
                          if (category) {
                            openRoomStatus(category);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveManagementSection("add-room");
                          setRoomForm({
                            property_id: row.property_id,
                            room_name: row.room_name || "",
                            room_name_lang: row.room_name || "",
                            base_rate: String(row.base_rate ?? "0"),
                            tax_and_service_fee: "0",
                            surcharges: "0",
                            mandatory_fee: "0",
                            resort_fee: "0",
                            mandatory_tax: "0",
                          });
                          setRoomSubmitSuccess(
                            `Loaded ${row.room_id} into the Add Room form for quick editing.`,
                          );
                          setRoomSubmitError("");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:border-amber-300 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRoomSubmitError(
                            `Delete action for ${row.room_id} is UI-only for now. Backend delete API is not available yet.`,
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data.rooms.length ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No rooms available for {selectedPropertyId} yet. Use the Add Room card above to create one.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </PmsShell>
  );
}
