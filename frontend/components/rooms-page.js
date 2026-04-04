"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PmsShell } from "./pms-shell";
import { fetchJson } from "../lib/api";

const fallbackData = {
  property: { property_id: "", name: "Selected Property" },
  summary: {
    total_rooms: 0,
    available_inventory: 0,
    sold_inventory: 0,
    blocked_inventory: 0,
    occupancy_percent: 0,
  },
  categories: [],
  rooms: [],
};

function createRoomForm(propertyId) {
  return {
    property_id: propertyId,
    room_name: "",
    room_name_lang: "",
    room_status: "PROCESSING",
    base_rate: "0",
    tax_and_service_fee: "0",
    surcharges: "0",
    mandatory_fee: "0",
    resort_fee: "0",
    mandatory_tax: "0",
  };
}

function createImageForm() {
  return {
    room_name: "",
    image_url: "https://images.example.com/rooms/deluxe-suite.jpg",
    alt_text: "",
  };
}

function createRoomEditorForm(room = {}) {
  return {
    room_name: room.room_name || "",
    room_name_lang: room.room_name_lang || "",
    room_status: room.room_status || room.status || "PROCESSING",
    base_rate: room.base_rate != null ? String(room.base_rate) : "0",
    tax_and_service_fee: room.tax_and_service_fee != null ? String(room.tax_and_service_fee) : "0",
    surcharges: room.surcharges != null ? String(room.surcharges) : "0",
    mandatory_fee: room.mandatory_fee != null ? String(room.mandatory_fee) : "0",
    resort_fee: room.resort_fee != null ? String(room.resort_fee) : "0",
    mandatory_tax: room.mandatory_tax != null ? String(room.mandatory_tax) : "0",
  };
}

function createRatePlanEditorForm(ratePlan = {}) {
  return {
    rate_id: ratePlan.rate_id || "",
    title: ratePlan.title || "",
    supplier_name: ratePlan.supplier_name || "",
    meal_plan: ratePlan.meal_plan || "RO",
    currency: ratePlan.currency || "USD",
    base_rate: ratePlan.base_rate != null ? String(ratePlan.base_rate) : "0",
    available_inventory: ratePlan.available_inventory != null ? String(ratePlan.available_inventory) : "0",
    total_inventory: ratePlan.total_inventory != null ? String(ratePlan.total_inventory) : "0",
    sold_inventory: ratePlan.sold_inventory != null ? String(ratePlan.sold_inventory) : "0",
    status: Boolean(ratePlan.status),
  };
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildRoomPayload(roomForm, propertyId) {
  return {
    property_id: propertyId,
    room_name: roomForm.room_name.trim(),
    room_name_lang: roomForm.room_name_lang.trim() || roomForm.room_name.trim(),
    base_rate: numberValue(roomForm.base_rate),
    tax_and_service_fee: numberValue(roomForm.tax_and_service_fee),
    surcharges: numberValue(roomForm.surcharges),
    mandatory_fee: numberValue(roomForm.mandatory_fee),
    resort_fee: numberValue(roomForm.resort_fee),
    mandatory_tax: numberValue(roomForm.mandatory_tax),
  };
}

function buildPreviewRows(roomForm, propertyId) {
  const payload = buildRoomPayload(roomForm, propertyId);
  const totalPrice =
    payload.base_rate +
    payload.tax_and_service_fee +
    payload.surcharges +
    payload.mandatory_fee +
    payload.resort_fee +
    payload.mandatory_tax;

  return [
    ["Property ID", payload.property_id],
    ["Room Name", payload.room_name || "-"],
    ["Display Name", payload.room_name_lang || "-"],
    ["Base Rate", payload.base_rate],
    ["Tax & Service Fee", payload.tax_and_service_fee],
    ["Surcharges", payload.surcharges],
    ["Mandatory Fee", payload.mandatory_fee],
    ["Resort Fee", payload.resort_fee],
    ["Mandatory Tax", payload.mandatory_tax],
    ["Total Price", totalPrice],
  ];
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

function getRoomLaunchBadge(status) {
  const summary = getCompletionSummary(status);

  if (status?.sales_ready) {
    return {
      label: "Active",
      className: "bg-emerald-100 text-emerald-700",
      detail: "Live for sale",
    };
  }

  if (summary.completedCount === 0) {
    return {
      label: "Pending",
      className: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
      detail: "Not started",
    };
  }

  return {
    label: "Processing",
    className: "bg-amber-100 text-amber-700",
    detail: `${summary.percent}% complete`,
  };
}

function getBackendRoomStatusBadge(roomStatus) {
  switch ((roomStatus || "PROCESSING").toUpperCase()) {
    case "LIVE":
      return {
        label: "Live",
        className: "bg-emerald-100 text-emerald-700",
        detail: "Active selling stage",
      };
    case "BLOCKED":
      return {
        label: "Blocked",
        className: "bg-rose-100 text-rose-700",
        detail: "Sales blocked",
      };
    case "MAINTENANCE":
      return {
        label: "Maintenance",
        className: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
        detail: "Under maintenance",
      };
    case "INACTIVE":
      return {
        label: "Inactive",
        className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
        detail: "Not currently active",
      };
    default:
      return {
        label: "Processing",
        className: "bg-amber-100 text-amber-700",
        detail: "Setup in progress",
      };
  }
}

export function RoomsManagementPage({ propertyId }) {
  const router = useRouter();
  const selectedPropertyId = propertyId || "";
  const hasSelectedProperty = Boolean(selectedPropertyId);
  const [activeManagementSection, setActiveManagementSection] = useState("add-room");
  const [data, setData] = useState(fallbackData);
  const [apiConnected, setApiConnected] = useState(false);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [roomForm, setRoomForm] = useState(() => createRoomForm(selectedPropertyId));
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showRoomPreview, setShowRoomPreview] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomSubmitError, setRoomSubmitError] = useState("");
  const [roomSubmitSuccess, setRoomSubmitSuccess] = useState("");
  const [createdRoomId, setCreatedRoomId] = useState("");
  const [imageForm, setImageForm] = useState(createImageForm);
  const [imageDrafts, setImageDrafts] = useState([]);
  const [imageSubmitMessage, setImageSubmitMessage] = useState("");
  const [roomLaunchStatuses, setRoomLaunchStatuses] = useState({});
  const [activeRoomId, setActiveRoomId] = useState("");
  const [roomStatusMode, setRoomStatusMode] = useState("form");
  const [activeRoomDetail, setActiveRoomDetail] = useState(null);
  const [roomEditorForm, setRoomEditorForm] = useState(() => createRoomEditorForm());
  const [loadingRoomDetail, setLoadingRoomDetail] = useState(false);
  const [savingRoomDetail, setSavingRoomDetail] = useState(false);
  const [roomDetailError, setRoomDetailError] = useState("");
  const [roomDetailSuccess, setRoomDetailSuccess] = useState("");
  const [selectedRatePlanId, setSelectedRatePlanId] = useState("");
  const [ratePlanEditorForm, setRatePlanEditorForm] = useState(() => createRatePlanEditorForm());
  const [savingRatePlan, setSavingRatePlan] = useState(false);
  const [ratePlanError, setRatePlanError] = useState("");
  const [ratePlanSuccess, setRatePlanSuccess] = useState("");
  const propertyLocation = "Location info not available";
  const roomStatusStorageKey = `inno-rooms-room-launch-status:${selectedPropertyId}`;

  async function loadOverview() {
    if (!selectedPropertyId) {
      setData(fallbackData);
      setApiConnected(false);
      setLoadingOverview(false);
      return;
    }

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
    setShowRoomPreview(false);
    setRoomSubmitError("");
    setRoomSubmitSuccess("");
    setCreatedRoomId("");
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
    setActiveRoomDetail(null);
    setRoomEditorForm(createRoomEditorForm());
    setSelectedRatePlanId("");
    setRatePlanEditorForm(createRatePlanEditorForm());
    setRoomDetailError("");
    setRoomDetailSuccess("");
    setRatePlanError("");
    setRatePlanSuccess("");
  }, [roomStatusStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(roomStatusStorageKey, JSON.stringify(roomLaunchStatuses));
    } catch {}
  }, [roomLaunchStatuses, roomStatusStorageKey]);

  function applyRoomDetailToEditors(roomDetail, fallbackCategory) {
    setActiveRoomDetail(roomDetail);
    setRoomEditorForm(createRoomEditorForm(roomDetail));
    const preferredRatePlan =
      roomDetail?.current_rate_plan || roomDetail?.rate_plans?.[0] || null;
    setSelectedRatePlanId(preferredRatePlan?.rate_id || "");
    setRatePlanEditorForm(createRatePlanEditorForm(preferredRatePlan || {}));
    if (!roomDetail && fallbackCategory) {
      setRoomEditorForm(
        createRoomEditorForm({
          room_name: fallbackCategory.room_name,
          room_name_lang: fallbackCategory.room_name,
          room_status: fallbackCategory.room_status || fallbackCategory.status || "PROCESSING",
          base_rate: fallbackCategory.base_rate,
        }),
      );
    }
  }

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

  const activeRatePlans = activeRoomDetail?.rate_plans || [];
  const roomPreviewRows = useMemo(
    () => buildPreviewRows(roomForm, selectedPropertyId),
    [roomForm, selectedPropertyId],
  );
  const hasRoomName = roomForm.room_name.trim().length > 0;

  async function handleCreateRoom(event) {
    event.preventDefault();
    setCreatingRoom(true);
    setRoomSubmitError("");
    setRoomSubmitSuccess("");

    try {
      const payload = buildRoomPayload(roomForm, selectedPropertyId);

      const createdRoom = await fetchJson("/rooms", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setRoomSubmitSuccess(`Room created for property ${selectedPropertyId}.`);
      setCreatedRoomId(createdRoom.room_id || "");
      setShowRoomPreview(false);
      setRoomForm(createRoomForm(selectedPropertyId));
      await loadOverview();
    } catch (error) {
      setRoomSubmitError(error.message || "Could not create room.");
    } finally {
      setCreatingRoom(false);
    }
  }

  function handlePreviewRoom() {
    if (!hasRoomName) {
      setRoomSubmitError("Enter a room name before opening preview.");
      setRoomSubmitSuccess("");
      setShowRoomPreview(false);
      return;
    }

    setRoomSubmitError("");
    setRoomSubmitSuccess("");
    setShowRoomPreview(true);
  }

  function openCreateRoomModal() {
    setRoomForm(createRoomForm(selectedPropertyId));
    setShowRoomPreview(false);
    setRoomSubmitError("");
    setRoomSubmitSuccess("");
    setShowCreateRoomModal(true);
  }

  function closeCreateRoomModal() {
    setShowCreateRoomModal(false);
    setShowRoomPreview(false);
    setRoomSubmitError("");
  }

  function handleSkipForNow() {
    if (!selectedPropertyId) {
      router.push("/properties");
      return;
    }

    router.push(`/inventory?property_id=${encodeURIComponent(selectedPropertyId)}`);
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

  async function openRoomStatus(category) {
    const existingStatus = roomLaunchStatuses[category.room_id] || createRoomLaunchStatus();
    setRoomLaunchStatuses((current) => ({
      ...current,
      [category.room_id]: current[category.room_id] || existingStatus,
    }));
    setActiveRoomId(category.room_id);
    setRoomStatusMode(existingStatus.sales_ready ? "success" : "form");
    setRoomDetailError("");
    setRoomDetailSuccess("");
    setRatePlanError("");
    setRatePlanSuccess("");
    setLoadingRoomDetail(true);

    try {
      const roomDetail = await fetchJson(`/rooms/${category.room_id}`);
      applyRoomDetailToEditors(roomDetail, category);
    } catch (error) {
      applyRoomDetailToEditors(null, category);
      setRoomDetailError(error.message || "Could not load room details.");
    } finally {
      setLoadingRoomDetail(false);
    }
  }

  async function handlePreviewCreatedRoom() {
    if (!createdRoomId) {
      return;
    }

    const category =
      data.categories.find((item) => item.room_id === createdRoomId) ||
      data.categories.find((item) => item.room_name === roomForm.room_name);

    if (!category) {
      setRoomSubmitError(`Created room ${createdRoomId} is not available in the overview yet.`);
      return;
    }

    setActiveManagementSection("add-room");
    await openRoomStatus(category);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  async function handleSaveRoomDetail(event) {
    event.preventDefault();

    if (!activeCategory) {
      return;
    }

    setSavingRoomDetail(true);
    setRoomDetailError("");
    setRoomDetailSuccess("");

    try {
      const updatedRoom = await fetchJson(`/rooms/${activeCategory.room_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          room_name: roomEditorForm.room_name.trim(),
          room_name_lang: roomEditorForm.room_name_lang.trim() || roomEditorForm.room_name.trim(),
          room_status: roomEditorForm.room_status.trim() || "PROCESSING",
          base_rate: numberValue(roomEditorForm.base_rate),
          tax_and_service_fee: numberValue(roomEditorForm.tax_and_service_fee),
          surcharges: numberValue(roomEditorForm.surcharges),
          mandatory_fee: numberValue(roomEditorForm.mandatory_fee),
          resort_fee: numberValue(roomEditorForm.resort_fee),
          mandatory_tax: numberValue(roomEditorForm.mandatory_tax),
        }),
      });

      applyRoomDetailToEditors(updatedRoom, activeCategory);
      setRoomDetailSuccess(`Saved changes for ${updatedRoom.room_id}.`);
      await loadOverview();
    } catch (error) {
      setRoomDetailError(error.message || "Could not save room changes.");
    } finally {
      setSavingRoomDetail(false);
    }
  }

  async function handleSaveRatePlan(event) {
    event.preventDefault();

    if (!selectedRatePlanId) {
      setRatePlanError("Select a rate plan first.");
      return;
    }

    setSavingRatePlan(true);
    setRatePlanError("");
    setRatePlanSuccess("");

    try {
      await fetchJson(`/rate-plans/${selectedRatePlanId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: ratePlanEditorForm.title.trim(),
          supplier_name: ratePlanEditorForm.supplier_name.trim(),
          meal_plan: ratePlanEditorForm.meal_plan.trim(),
          currency: ratePlanEditorForm.currency.trim(),
          base_rate: numberValue(ratePlanEditorForm.base_rate),
          available_inventory: Math.trunc(numberValue(ratePlanEditorForm.available_inventory)),
          total_inventory: Math.trunc(numberValue(ratePlanEditorForm.total_inventory)),
          sold_inventory: Math.trunc(numberValue(ratePlanEditorForm.sold_inventory)),
          status: Boolean(ratePlanEditorForm.status),
        }),
      });

      const refreshedRoom = await fetchJson(`/rooms/${activeCategory.room_id}`);
      applyRoomDetailToEditors(refreshedRoom, activeCategory);
      setSelectedRatePlanId(selectedRatePlanId);
      const refreshedSelected = (refreshedRoom.rate_plans || []).find(
        (item) => item.rate_id === selectedRatePlanId,
      );
      setRatePlanEditorForm(createRatePlanEditorForm(refreshedSelected || refreshedRoom.current_rate_plan || {}));
      setRatePlanSuccess(`Saved changes for ${selectedRatePlanId}.`);
      await loadOverview();
    } catch (error) {
      setRatePlanError(error.message || "Could not save rate plan changes.");
    } finally {
      setSavingRatePlan(false);
    }
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

      {!hasSelectedProperty ? (
        <section className="mb-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <span className="material-symbols-outlined text-4xl text-slate-400">
            holiday_village
          </span>
          <h3 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Select a property first
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Open this page with a `property_id` to manage rooms, inventory, and room setup.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/properties"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Go to Properties
            </Link>
          </div>
        </section>
      ) : (
      <>
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

      {/* <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
      </section> */}

      {activeManagementSection === "room-image" ? (
      <section className="mb-8">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="mb-5">
            <h3 className="text-xl font-bold">Room Image Draft</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Image upload is not supported by the current backend room API, so this card keeps a dummy image URL ready for a future image endpoint.
            </p>
          </div>

          {/* <form onSubmit={handleSaveImageDraft}>
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
          </div> */}
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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">Room Inventory Table</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Directly rendered from the room overview response.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {loadingOverview ? "Refreshing room table..." : `${data.rooms.length} rows loaded`}
            </div>
            <button
              type="button"
              onClick={openCreateRoomModal}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined text-base">add_home</span>
              Create Room
            </button>
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
                  <td className="py-4 pr-4 text-slate-600 dark:text-slate-300">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{row.room_id}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {row.room_name || "Unnamed room"}
                      </p>
                    </div>
                  </td>
                  {[row.property_id, `$${Number(row.base_rate).toFixed(2)}`, row.status, row.housekeeping_status, row.note].map(
                    (cell, index) => (
                      <td
                        key={`${row.room_id}-${index}`}
                        className="py-4 pr-4 text-slate-600 dark:text-slate-300"
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
                        onClick={() =>
                          router.push(
                            `/daily-rates?property_id=${encodeURIComponent(row.property_id)}`,
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:border-amber-300 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
                      >
                        <span className="material-symbols-outlined text-sm">sell</span>
                        Add Rate
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
      {showCreateRoomModal ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Create Room</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Add a new room for {data.property.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Create the room directly from the rooms-management workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateRoomModal}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
              >
                <span className="material-symbols-outlined text-base">close</span>
                Close
              </button>
            </div>

            <form
              onSubmit={async (event) => {
                await handleCreateRoom(event);
                if (!roomSubmitError) {
                  setShowCreateRoomModal(false);
                }
              }}
              className="mt-6 space-y-4"
            >
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

              {roomSubmitError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {roomSubmitError}
                </p>
              ) : null}
              {roomSubmitSuccess ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {roomSubmitSuccess}
                </p>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeCreateRoomModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRoom}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingRoom ? "Creating..." : "Create Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {activeCategory ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Room View</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {roomEditorForm.room_name || activeCategory.room_name}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {activeCategory.room_id} • {data.property.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveRoomId("");
                  setActiveRoomDetail(null);
                  setRoomDetailError("");
                  setRoomDetailSuccess("");
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
              >
                <span className="material-symbols-outlined text-base">close</span>
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Room ID</p>
                <p className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">{activeCategory.room_id}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Property</p>
                <p className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">{data.property.property_id}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Current Status</p>
                <p className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">
                  {roomEditorForm.room_status || activeCategory.room_status || activeCategory.status || "PROCESSING"}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveRoomDetail} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Room Name
                  <input
                    type="text"
                    value={roomEditorForm.room_name}
                    onChange={(event) =>
                      setRoomEditorForm((current) => ({ ...current, room_name: event.target.value }))
                    }
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Display Name
                  <input
                    type="text"
                    value={roomEditorForm.room_name_lang}
                    onChange={(event) =>
                      setRoomEditorForm((current) => ({ ...current, room_name_lang: event.target.value }))
                    }
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Room Status
                  <select
                    value={roomEditorForm.room_status}
                    onChange={(event) =>
                      setRoomEditorForm((current) => ({ ...current, room_status: event.target.value }))
                    }
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {["PROCESSING", "LIVE", "BLOCKED", "MAINTENANCE", "INACTIVE"].map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {statusOption}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Base Rate
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={roomEditorForm.base_rate}
                    onChange={(event) =>
                      setRoomEditorForm((current) => ({ ...current, base_rate: event.target.value }))
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
                    value={roomEditorForm.tax_and_service_fee}
                    onChange={(event) =>
                      setRoomEditorForm((current) => ({ ...current, tax_and_service_fee: event.target.value }))
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
                    value={roomEditorForm.surcharges}
                    onChange={(event) =>
                      setRoomEditorForm((current) => ({ ...current, surcharges: event.target.value }))
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
                    value={roomEditorForm.mandatory_fee}
                    onChange={(event) =>
                      setRoomEditorForm((current) => ({ ...current, mandatory_fee: event.target.value }))
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
                    value={roomEditorForm.resort_fee}
                    onChange={(event) =>
                      setRoomEditorForm((current) => ({ ...current, resort_fee: event.target.value }))
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
                    value={roomEditorForm.mandatory_tax}
                    onChange={(event) =>
                      setRoomEditorForm((current) => ({ ...current, mandatory_tax: event.target.value }))
                    }
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </label>
              </div>

              {loadingRoomDetail ? (
                <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                  Loading room details...
                </p>
              ) : null}
              {roomDetailError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {roomDetailError}
                </p>
              ) : null}
              {roomDetailSuccess ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {roomDetailSuccess}
                </p>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveRoomId("");
                    setActiveRoomDetail(null);
                    setRoomDetailError("");
                    setRoomDetailSuccess("");
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={savingRoomDetail || loadingRoomDetail}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingRoomDetail ? "Saving..." : "Save Room Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      </>
      ) }
    </PmsShell>
  );
}
