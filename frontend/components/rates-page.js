"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PmsShell } from "./pms-shell";
import { useTheme } from "./theme-provider";
import { fetchJson } from "../lib/api";

const visibleMatrixDays = 21;
const unavailableStatuses = [
  "UNAVAILABLE",
  "BOOKED",
  "PROSSING",
  "AB-UNAVAILABLE",
  "CTA",
  "CTD",
  "STOP_SELL",
  "OUT_OF_ORDER",
  "OUT_OF_SERVICE",
  "OVERBOOKED",
];

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
    box: "rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/80",
    note: "mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400",
    input:
      "w-full border-none bg-transparent p-0 text-left text-sm font-bold text-slate-900 focus:ring-0 dark:text-slate-100",
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
      "w-full border-none bg-transparent p-0 text-left text-sm font-bold text-slate-900 focus:ring-0 dark:text-slate-100",
  },
  disabled: {
    box: "rounded-xl border border-slate-200 bg-slate-100/70 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/70",
    note: "mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400",
    input:
      "w-full border-none bg-transparent p-0 text-left text-sm font-bold text-slate-400 focus:ring-0",
  },
};

function createDays(startDate, total) {
  const start = parseCalendarDate(startDate || new Date());

  return Array.from({ length: total }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      isoDate: toIsoDateFromParts(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      ),
      shortDay: date.toLocaleDateString("en-US", { weekday: "short" }),
      dayNum: String(date.getDate()).padStart(2, "0"),
      month: date.toLocaleDateString("en-US", { month: "short" }),
    };
  });
}

function getTone(item, index) {
  if (
    [
      "UNAVAILABLE",
      "STOP_SELL",
      "OUT_OF_ORDER",
      "OUT_OF_SERVICE",
      "OVERBOOKED",
      "AB-UNAVAILABLE",
    ].includes(item.availability)
  ) {
    return "disabled";
  }
  if (index === 0) {
    return "primary";
  }
  if (["BOOKED", "PROSSING", "CTA", "CTD"].includes(item.availability)) {
    return "amber";
  }
  return Number(item.base_rate) >= 220 ? "emerald" : "default";
}

function isUnavailableAvailability(value) {
  return (
    !value || unavailableStatuses.includes(String(value || "").toUpperCase())
  );
}

function getAvailabilityDisplayLabel(value) {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "BOOKED" || normalized === "AB-UNAVAILABLE") {
    return "BOOKED";
  }
  if (normalized === "PROSSING") {
    return "PROCESSING";
  }
  return isUnavailableAvailability(value) ? "UNAVAILABLE" : "AVAILABLE";
}

function getAvailabilitySelectValue(value) {
  return isUnavailableAvailability(value) ? "UNAVAILABLE" : "AVAILABLE";
}

function normalizeAvailabilityInput(value) {
  return value;
}

function getCellNote(availability, index) {
  if (!availability) {
    return "No data";
  }
  if (availability === "BOOKED") {
    return "Booked";
  }
  if (availability === "PROSSING") {
    return "Processing";
  }
  if (availability === "AB-UNAVAILABLE") {
    return "Alt booked";
  }
  if (availability === "UNAVAILABLE") {
    return "Unavailable";
  }
  if (["CTA", "CTD"].includes(availability)) {
    return "Review";
  }
  return index === 0 ? "Today" : availability;
}

function getAvailabilityUiClasses(availability) {
  const normalized = String(availability || "").toUpperCase();
  if (!normalized) {
    return {
      box: "border-slate-300 bg-slate-100/90",
      badge: "border-slate-300 bg-slate-100 text-slate-600",
      select: "border-slate-300 bg-slate-50 text-slate-600",
    };
  }
  if (normalized === "AVAILABLE") {
    return {
      box: "border-emerald-200 bg-emerald-50/70",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      select: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (normalized === "UNAVAILABLE") {
    return {
      box: "border-rose-200 bg-rose-50/80",
      badge: "border-rose-200 bg-rose-50 text-rose-700",
      select: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  return {
    box: "",
    badge: isUnavailableAvailability(normalized)
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700",
    select: isUnavailableAvailability(normalized)
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

function toIsoDateFromParts(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseCalendarDate(value = new Date()) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
      );
    }
  }

  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getMonthStartIsoDate(value = new Date()) {
  const date = parseCalendarDate(value);
  return toIsoDateFromParts(date.getFullYear(), date.getMonth(), 1);
}

function getDaysInMonth(value = new Date()) {
  const date = parseCalendarDate(value);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function parseRateValue(value) {
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatRateValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "0.00";
}

function formatDisplayRateValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0";
  }
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2);
}

function formatMoneyWithCurrency(currency, value) {
  const normalizedCurrency = (currency || "USD").toUpperCase();
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return `${normalizedCurrency} 0.00`;
  }
  return `${normalizedCurrency} ${amount.toFixed(2)}`;
}

function parseIntegerValue(value) {
  const numeric = Number.parseInt(String(value), 10);
  return Number.isFinite(numeric) ? numeric : 0;
}

function enumerateDateRange(startDate, endDate) {
  if (!startDate || !endDate || startDate > endDate) {
    return [];
  }

  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (cursor <= end) {
    dates.push(
      toIsoDateFromParts(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate(),
      ),
    );
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function createRatePlanForm(room) {
  return {
    rate_id: "",
    room_id: room?.room_id || "",
    title: "",
    description: "",
    meal_plan: "",
    is_refundable: false,
    bed_type: "",
    cancellation_policy: "",
    status: false,
    min_stay: "",
    max_stay: "",
    currency: "",
    base_rate: "",
    tax_and_service_fee: "",
    surcharges: "",
    mandatory_fee: "",
    resort_fee: "",
    mandatory_tax: "",
    total_inventory: "",
    available_inventory: "",
    sold_inventory: "",
    closed_to_arrival: false,
    closed_to_departure: false,
    stop_sell: false,
    extra_adult_rate: "",
    extra_child_rate: "",
  };
}

function createRatePlanPayload(form) {
  return {
    room_id: form.room_id,
    title: form.title.trim(),
    description: form.description.trim(),
    meal_plan: form.meal_plan.trim(),
    is_refundable: Boolean(form.is_refundable),
    bed_type: form.bed_type.trim(),
    cancellation_policy: form.cancellation_policy.trim(),
    status: Boolean(form.status),
    min_stay: parseIntegerValue(form.min_stay || "0"),
    max_stay: parseIntegerValue(form.max_stay || "0"),
    currency: (form.currency || "USD").trim(),
    base_rate: Number(form.base_rate || 0),
    tax_and_service_fee: Number(form.tax_and_service_fee || 0),
    surcharges: Number(form.surcharges || 0),
    mandatory_fee: Number(form.mandatory_fee || 0),
    resort_fee: Number(form.resort_fee || 0),
    mandatory_tax: Number(form.mandatory_tax || 0),
    total_inventory: parseIntegerValue(form.total_inventory || "0"),
    available_inventory: parseIntegerValue(form.available_inventory || "0"),
    sold_inventory: parseIntegerValue(form.sold_inventory || "0"),
    closed_to_arrival: Boolean(form.closed_to_arrival),
    closed_to_departure: Boolean(form.closed_to_departure),
    stop_sell: Boolean(form.stop_sell),
    extra_adult_rate: Number(form.extra_adult_rate || 0),
    extra_child_rate: Number(form.extra_child_rate || 0),
  };
}

function createRatePlanFormFromDetails(room, ratePlan) {
  return {
    ...createRatePlanForm(room),
    rate_id: ratePlan?.rate_id || "",
    room_id: ratePlan?.room_id || room?.room_id || "",
    title: ratePlan?.title || "",
    description: ratePlan?.description || "",
    meal_plan: ratePlan?.meal_plan || "BB",
    is_refundable: Boolean(ratePlan?.is_refundable),
    bed_type: ratePlan?.bed_type || "",
    cancellation_policy: ratePlan?.cancellation_policy || "",
    status: Boolean(ratePlan?.status),
    min_stay: String(ratePlan?.min_stay ?? 1),
    max_stay: String(ratePlan?.max_stay ?? 30),
    currency: ratePlan?.currency || "USD",
    base_rate: formatRateValue(ratePlan?.base_rate ?? 0),
    tax_and_service_fee: formatRateValue(ratePlan?.tax_and_service_fee ?? 0),
    surcharges: formatRateValue(ratePlan?.surcharges ?? 0),
    mandatory_fee: formatRateValue(ratePlan?.mandatory_fee ?? 0),
    resort_fee: formatRateValue(ratePlan?.resort_fee ?? 0),
    mandatory_tax: formatRateValue(ratePlan?.mandatory_tax ?? 0),
    total_inventory: String(ratePlan?.total_inventory ?? 0),
    available_inventory: String(ratePlan?.available_inventory ?? 0),
    sold_inventory: String(ratePlan?.sold_inventory ?? 0),
    closed_to_arrival: Boolean(ratePlan?.closed_to_arrival),
    closed_to_departure: Boolean(ratePlan?.closed_to_departure),
    stop_sell: Boolean(ratePlan?.stop_sell),
    extra_adult_rate: formatRateValue(ratePlan?.extra_adult_rate ?? 0),
    extra_child_rate: formatRateValue(ratePlan?.extra_child_rate ?? 0),
  };
}

function getRoomSummarySource(roomSummary, selectedRoomForRatePlan) {
  return roomSummary || selectedRoomForRatePlan || null;
}

function buildRowsFromApi(
  rooms,
  ratePlans,
  calendarByRateId,
  startDate,
  total,
  inventoryRows = [],
) {
  if (!ratePlans.length) {
    return [];
  }

  const roomMap = new Map(rooms.map((room) => [room.room_id, room]));
  const bookingByRoomId = new Map(
    (inventoryRows || []).map((row) => [row.room_id, row.booking || null]),
  );
  const normalizedStart = parseCalendarDate(startDate || new Date());

  return ratePlans.map((ratePlan) => {
    const room = roomMap.get(ratePlan.room_id);
    const booking = bookingByRoomId.get(ratePlan.room_id);
    const calendar = calendarByRateId[ratePlan.rate_id] || [];
    const calendarMap = new Map(calendar.map((item) => [item.stay_date, item]));
    const occupancyPercent = ratePlan.total_inventory
      ? Math.round((ratePlan.sold_inventory / ratePlan.total_inventory) * 100)
      : 0;
    const cells = Array.from({ length: total }, (_, index) => {
      const currentDate = new Date(normalizedStart);
      currentDate.setDate(normalizedStart.getDate() + index);
      const stayDate = toIsoDateFromParts(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate(),
      );
      const item = calendarMap.get(stayDate);
      const fallbackBooked =
        booking?.check_in_date &&
        booking?.check_out_date &&
        booking?.rate_id === ratePlan.rate_id &&
        stayDate >= booking.check_in_date &&
        stayDate < booking.check_out_date;
      const fallbackBookingStatus = String(
        booking?.booking_status || "",
      ).toUpperCase();
      const availability =
        item?.availability ||
        (fallbackBooked
          ? ["CONFIRMED", "CHECKED_IN"].includes(fallbackBookingStatus)
            ? "BOOKED"
            : "PROSSING"
          : "");
      const baseRate = formatRateValue(
        item?.base_rate ?? ratePlan.base_rate ?? 0,
      );
      const tax = formatRateValue(item?.tax ?? 0);
      return {
        stay_date: stayDate,
        currency: item?.currency || ratePlan.currency || "USD",
        tax,
        availability,
        base_rate: baseRate,
        original_base_rate: baseRate,
        original_availability: availability,
        changed: false,
        note: getCellNote(availability, index),
        tone: getTone({ availability, base_rate: Number(baseRate) }, index),
      };
    });

    return {
      roomId: ratePlan.room_id,
      title: ratePlan.title || room?.room_name || ratePlan.rate_id,
      roomLabel: room?.room_name
        ? `${room.room_name} • ${room.room_id}`
        : room?.room_id || ratePlan.room_id,
      code: ratePlan.rate_id,
      subtitle: `${ratePlan.available_inventory} available`,
      occupancy: `${occupancyPercent}%`,
      strategy: ratePlan.description || ratePlan.cancellation_policy,
      stopSell: Boolean(ratePlan.stop_sell),
      cta: Boolean(ratePlan.closed_to_arrival),
      ctd: Boolean(ratePlan.closed_to_departure),
      cells,
    };
  });
}

function buildHotelSummaryFallback(
  rooms,
  ratePlans,
  startDate,
  total,
  inventoryRows = [],
) {
  const liveRooms = (rooms || []).filter(
    (room) => String(room.room_status || "").toUpperCase() === "LIVE",
  );
  const liveRoomIds = new Set(liveRooms.map((room) => room.room_id));
  const rowsByRoomId = new Map(
    (inventoryRows || []).map((row) => [row.room_id, row]),
  );
  const days = createDays(startDate, total);

  return days.map((day) => {
    const bookedRoomIds = new Set();

    for (const room of liveRooms) {
      const booking = rowsByRoomId.get(room.room_id)?.booking;
      if (!booking?.check_in_date || !booking?.check_out_date) {
        continue;
      }
      if (
        day.isoDate >= booking.check_in_date &&
        day.isoDate < booking.check_out_date
      ) {
        bookedRoomIds.add(room.room_id);
      }
    }

    const rateIds = (ratePlans || [])
      .filter((ratePlan) => {
        if (!liveRoomIds.has(ratePlan.room_id)) {
          return false;
        }
        if (ratePlan.status === false || ratePlan.status === 0) {
          return false;
        }
        if (
          ratePlan.stop_sell ||
          ratePlan.closed_to_arrival ||
          ratePlan.closed_to_departure
        ) {
          return false;
        }
        const calendarItem = (ratePlan.calendar || []).find(
          (item) => item.stay_date === day.isoDate,
        );
        return (
          calendarItem && !isUnavailableAvailability(calendarItem.availability)
        );
      })
      .map((ratePlan) => ratePlan.rate_id);

    const totalActiveRoom = liveRooms.length;
    const bookedRoom = bookedRoomIds.size;
    const availableRoom = Math.max(totalActiveRoom - bookedRoom, 0);

    return {
      stay_date: day.isoDate,
      total_active_room: totalActiveRoom,
      total_active_rate: rateIds.length,
      booked_room: bookedRoom,
      available_room: availableRoom,
      unavailable_room: totalActiveRoom - availableRoom,
      room_ids: liveRooms.map((room) => room.room_id),
      rate_ids: rateIds,
    };
  });
}

function normalizeAvailableDatesResponse(payload) {
  const availability = Array.isArray(payload?.availability)
    ? payload.availability
    : [];

  return availability.map((entry) => {
    const rooms = Array.isArray(entry?.rooms) ? entry.rooms : [];
    return {
      date: entry?.date || "",
      rooms,
      room_ids: rooms.map((room) => room.room_id).filter(Boolean),
      rate_ids: rooms.flatMap((room) =>
        (Array.isArray(room?.rates) ? room.rates : [])
          .map((rate) => rate?.rate_id)
          .filter(Boolean),
      ),
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
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
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
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        {stat.value}
      </p>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {stat.note}
      </p>
    </article>
  );
}

export function DailyRatesPage({
  propertyId,
  autoOpenCreateRate = false,
  initialRoomId = "",
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const matrixScrollRef = useRef(null);
  const matrixDragRef = useRef({
    active: false,
    startX: 0,
    scrollLeft: 0,
  });
  const autoOpenedRateModalRef = useRef(false);
  const hasSelectedProperty = Boolean(propertyId);
  const liveRoomStatus = "LIVE";
  const [range, setRange] = useState(21);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(propertyId || "");
  const [rows, setRows] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [propertyName, setPropertyName] = useState("Selected Property");
  const [calendarStartDate, setCalendarStartDate] = useState(() =>
    getMonthStartIsoDate(),
  );
  const [apiConnected, setApiConnected] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishSuccess, setPublishSuccess] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [deletingRateId, setDeletingRateId] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [summaryPopover, setSummaryPopover] = useState(null);
  const [cellPopover, setCellPopover] = useState(null);
  const [availabilityStatuses, setAvailabilityStatuses] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [bedTypes, setBedTypes] = useState([]);
  const [showRatePlanModal, setShowRatePlanModal] = useState(false);
  const [selectedRoomForRatePlan, setSelectedRoomForRatePlan] = useState(null);
  const [selectedRoomSummary, setSelectedRoomSummary] = useState(null);
  const [ratePlanModalMode, setRatePlanModalMode] = useState("create");
  const [editingRatePlanId, setEditingRatePlanId] = useState("");
  const [ratePlanModalError, setRatePlanModalError] = useState("");
  const [ratePlanModalSuccess, setRatePlanModalSuccess] = useState("");
  const [savingNewRatePlan, setSavingNewRatePlan] = useState(false);
  const [loadingRatePlanDetails, setLoadingRatePlanDetails] = useState(false);
  const [loadingRoomSummary, setLoadingRoomSummary] = useState(false);
  const [roomListMessage, setRoomListMessage] = useState("");
  const [activeRoomPlansModal, setActiveRoomPlansModal] = useState(null);
  const matrixRoomColumnWidth = 200;
  const [availableDates, setAvailableDates] = useState([]);
  const [inventoryDates, setInventoryDates] = useState([]);
  const [rateMatrixSearch, setRateMatrixSearch] = useState("");
  const [bulkForm, setBulkForm] = useState({
    rate_id: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    base_rate: "",
    availability: "",
  });
  const [queuedCalendarUpdates, setQueuedCalendarUpdates] = useState({});
  const [newRatePlanForm, setNewRatePlanForm] = useState(
    createRatePlanForm(null),
  );
  const isLightTheme = resolvedTheme === "light";
  const isSoftLightTheme = resolvedTheme === "soft-light";
  const isDarkTheme = resolvedTheme === "dark";
  const isMidnightTheme = resolvedTheme === "midnight";
  const matrixThemeStyles = {
    panel: {
      borderColor: "var(--soft-border)",
      background: "var(--panel-bg)",
      boxShadow: isMidnightTheme
        ? "0 18px 40px rgba(2,6,23,0.28)"
        : isDarkTheme
          ? "0 14px 32px rgba(2,6,23,0.22)"
          : isSoftLightTheme
            ? "0 12px 30px rgba(120,63,109,0.14)"
            : "0 10px 24px rgba(15,23,42,0.08)",
    },
    headerRow: {
      background: isLightTheme
        ? "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(244,247,250,0.92) 100%)"
        : isSoftLightTheme
          ? "linear-gradient(135deg, rgba(116,43,101,0.82) 0%, rgba(154,73,137,0.78) 55%, rgba(201,120,184,0.72) 100%)"
          : isDarkTheme
            ? "linear-gradient(180deg, rgba(30,41,59,0.90) 0%, rgba(51,65,85,0.84) 100%)"
            : "linear-gradient(180deg, rgba(2,6,23,0.96) 0%, rgba(15,23,42,0.92) 100%)",
      borderBottom: isSoftLightTheme
        ? "1px solid rgba(255,255,255,0.16)"
        : isDarkTheme || isMidnightTheme
          ? "1px solid rgba(71,85,105,0.24)"
          : "1px solid rgba(148,163,184,0.16)",
      textClass:
        isSoftLightTheme || isDarkTheme || isMidnightTheme
          ? "text-white"
          : "text-slate-800",
      labelClass:
        isSoftLightTheme || isDarkTheme || isMidnightTheme
          ? "text-white/70"
          : "text-slate-500",
      todayBadgeClass: isSoftLightTheme
        ? "bg-white/18 text-white"
        : isDarkTheme || isMidnightTheme
          ? "bg-slate-100/12 text-slate-100"
          : "bg-slate-900 text-white",
    },
    subHeader: {
      background: isSoftLightTheme
        ? "rgba(255,240,248,0.76)"
        : isDarkTheme
          ? "rgba(30,41,59,0.84)"
          : isMidnightTheme
            ? "rgba(15,23,42,0.88)"
            : "rgba(248,250,252,0.94)",
      stickyBackground: isSoftLightTheme
        ? "rgb(255, 241, 247)"
        : isDarkTheme
          ? "rgb(30, 41, 59)"
          : isMidnightTheme
            ? "rgb(2, 6, 23)"
            : "rgb(248, 250, 252)",
      textClass:
        isSoftLightTheme
          ? "text-[#6f2f62]"
          : isDarkTheme || isMidnightTheme
            ? "text-white"
            : "text-slate-900",
      subtextClass:
        isSoftLightTheme
          ? "text-[#8b5e80]"
          : isDarkTheme || isMidnightTheme
            ? "text-white/70"
            : "text-slate-500",
    },
    firstColumn: {
      evenBg: isSoftLightTheme
        ? "linear-gradient(135deg, rgba(255,244,251,0.96) 0%, rgba(242,219,238,0.90) 100%)"
        : isDarkTheme
          ? "linear-gradient(135deg, rgba(51,65,85,0.84) 0%, rgba(30,41,59,0.90) 100%)"
          : isMidnightTheme
            ? "linear-gradient(135deg, rgba(15,23,42,0.94) 0%, rgba(2,6,23,0.98) 100%)"
            : "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(248,244,248,0.92) 100%)",
      oddBg: isSoftLightTheme
        ? "linear-gradient(135deg, rgba(252,235,245,0.96) 0%, rgba(245,223,238,0.90) 100%)"
        : isDarkTheme
          ? "linear-gradient(135deg, rgba(30,41,59,0.92) 0%, rgba(15,23,42,0.96) 100%)"
          : isMidnightTheme
            ? "linear-gradient(135deg, rgba(2,6,23,0.98) 0%, rgba(1,4,18,1) 100%)"
            : "linear-gradient(135deg, rgba(252,250,252,0.96) 0%, rgba(243,238,243,0.92) 100%)",
      titleClass: isSoftLightTheme
        ? "text-[#6f2f62]"
        : isDarkTheme || isMidnightTheme
          ? "text-slate-100"
          : "text-slate-900",
    },
    card: {
      background: isSoftLightTheme
        ? "rgba(255,255,255,0.84)"
        : isDarkTheme
          ? "rgba(15,23,42,0.84)"
          : isMidnightTheme
            ? "rgba(2,6,23,0.88)"
            : "rgba(255,255,255,0.94)",
      borderColor:
        isDarkTheme || isMidnightTheme
          ? "rgba(71,85,105,0.28)"
          : "rgba(148,163,184,0.16)",
      textClass:
        isDarkTheme || isMidnightTheme ? "text-slate-100" : "text-slate-900",
      mutedClass:
        isDarkTheme || isMidnightTheme ? "text-slate-300" : "text-slate-400",
      popupBackground: isSoftLightTheme
        ? "rgba(255,249,252,0.94)"
        : isDarkTheme
          ? "rgba(15,23,42,0.96)"
          : isMidnightTheme
            ? "rgba(2,6,23,0.98)"
            : "rgba(255,255,255,0.96)",
    },
  };
  const softLightGlassCardStyle = isSoftLightTheme
    ? {
        backgroundColor: "rgb(255, 249, 242)",
        backgroundImage:
          "linear-gradient(135deg, rgb(255 255 255 / 42%) 0%, rgb(255 249 242 / 72%) 48%, rgb(255 236 217 / 38%) 100%)",
        borderColor: "rgb(221 191 161 / 55%)",
        boxShadow: "0 20px 40px -28px rgb(146 104 62 / 22%)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }
    : undefined;
  const softLightGlassInsetStyle = isSoftLightTheme
    ? {
        backgroundColor: "rgb(255, 249, 242)",
        backgroundImage:
          "linear-gradient(135deg, rgb(255 255 255 / 36%) 0%, rgb(255 249 242 / 64%) 100%)",
        borderColor: "rgb(221 191 161 / 42%)",
        boxShadow: "inset 0 1px 0 rgb(255 255 255 / 60%)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }
    : undefined;
  const totalDays = useMemo(
    () => getDaysInMonth(calendarStartDate),
    [calendarStartDate],
  );
  const days = useMemo(
    () => createDays(calendarStartDate, totalDays),
    [calendarStartDate, totalDays],
  );
  const visibleDays = days;
  const matrixGridTemplate = useMemo(
    () =>
      `clamp(168px, 18vw, ${matrixRoomColumnWidth}px) repeat(${visibleDays.length}, minmax(0, 1fr))`,
    [visibleDays.length],
  );

  useEffect(() => {
    setSummaryPopover(null);
    setCellPopover(null);
  }, [selectedProperty, calendarStartDate, range]);

  // Track anchor visibility — close popover when anchor scrolls out of view
  useEffect(() => {
    const anchors = [summaryPopover?.anchorEl, cellPopover?.anchorEl].filter(
      Boolean,
    );

    if (!anchors.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            setSummaryPopover((c) => (c?.anchorEl === entry.target ? null : c));
            setCellPopover((c) => (c?.anchorEl === entry.target ? null : c));
          }
        }
      },
      { threshold: 0.1 },
    );

    for (const el of anchors) observer.observe(el);
    return () => observer.disconnect();
  }, [summaryPopover?.anchorEl, cellPopover?.anchorEl]);

  // Reposition popovers on scroll/resize
  useEffect(() => {
    function reposition() {
      setSummaryPopover((current) => {
        if (!current?.anchorEl) return current;
        const rect = current.anchorEl.getBoundingClientRect();
        const popupWidth = 220;
        const left = Math.max(
          16,
          Math.min(rect.right + 10, window.innerWidth - popupWidth - 16),
        );
        const top = Math.max(16, Math.min(rect.top, window.innerHeight - 260));
        return { ...current, left, top };
      });
      setCellPopover((current) => {
        if (!current?.anchorEl) return current;
        const rect = current.anchorEl.getBoundingClientRect();
        const popupWidth = 240;
        const left = Math.max(
          16,
          Math.min(rect.right + 10, window.innerWidth - popupWidth - 16),
        );
        const top = Math.max(16, Math.min(rect.top, window.innerHeight - 240));
        return { ...current, left, top };
      });
    }

    window.addEventListener("scroll", reposition, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, { capture: true });
      window.removeEventListener("resize", reposition);
    };
  }, []);
  const ratePlanPreview = useMemo(() => {
    const baseRate = parseRateValue(newRatePlanForm.base_rate);
    const taxAndServiceFee = parseRateValue(
      newRatePlanForm.tax_and_service_fee,
    );
    const surcharges = parseRateValue(newRatePlanForm.surcharges);
    const mandatoryFee = parseRateValue(newRatePlanForm.mandatory_fee);
    const resortFee = parseRateValue(newRatePlanForm.resort_fee);
    const mandatoryTax = parseRateValue(newRatePlanForm.mandatory_tax);
    const subtotal =
      baseRate +
      taxAndServiceFee +
      surcharges +
      mandatoryFee +
      resortFee +
      mandatoryTax;

    return {
      baseRate,
      taxAndServiceFee,
      surcharges,
      mandatoryFee,
      resortFee,
      mandatoryTax,
      subtotal,
      totalInventory: parseIntegerValue(newRatePlanForm.total_inventory),
      availableInventory: parseIntegerValue(
        newRatePlanForm.available_inventory,
      ),
      soldInventory: parseIntegerValue(newRatePlanForm.sold_inventory),
      minStay: parseIntegerValue(newRatePlanForm.min_stay),
      maxStay: parseIntegerValue(newRatePlanForm.max_stay),
    };
  }, [newRatePlanForm]);

  useEffect(() => {
    setSelectedProperty(propertyId || "");
  }, [propertyId]);

  useEffect(() => {
    setQueuedCalendarUpdates({});
    setBulkError("");
    setBulkSuccess("");
  }, [propertyId]);

  useEffect(() => {
    autoOpenedRateModalRef.current = false;
  }, [autoOpenCreateRate, initialRoomId, propertyId]);

  useEffect(() => {
    setSelectedDateIndex((current) =>
      Math.min(current, Math.max(totalDays - 1, 0)),
    );
  }, [totalDays, calendarStartDate]);

  useEffect(() => {
    let ignore = false;

    async function loadRates() {
      setLoadingRates(true);
      try {
        const [propertyList, statusList, mealPlanList, bedTypeList] =
          await Promise.all([
            fetchJson("/properties"),
            fetchJson("/rate-plans/availability-statuses").catch(() => []),
            fetchJson("/feature/meal-plans").catch(() => []),
            fetchJson("/feature/bed-type").catch(() => []),
          ]);
        if (ignore) {
          return;
        }

        setProperties(propertyList);
        setAvailabilityStatuses(Array.isArray(statusList) ? statusList : []);
        setMealPlans(Array.isArray(mealPlanList) ? mealPlanList : []);
        setBedTypes(Array.isArray(bedTypeList) ? bedTypeList : []);

        if (!propertyId) {
          if (!ignore) {
            setSelectedProperty("");
            setRows([]);
            setRooms([]);
            setInventoryDates([]);
            setBedTypes(Array.isArray(bedTypeList) ? bedTypeList : []);
            setPropertyName("Selected Property");
            setApiConnected(false);
            setLoadingRates(false);
          }
          return;
        }

        const resolvedPropertyId = propertyId;

        if (!ignore) {
          setSelectedProperty(resolvedPropertyId);
        }

        const inventoryEndDate =
          days[Math.max(totalDays - 1, 0)]?.isoDate || calendarStartDate;
        const [data, inventoryData, inventoryBoardData, availableDatesData] =
          await Promise.all([
            fetchJson(
              `/rate-plans/daily-rates?property_id=${encodeURIComponent(resolvedPropertyId)}&days=${totalDays}&start_date=${calendarStartDate}`,
            ),
            fetchJson(
              `/properties/${encodeURIComponent(resolvedPropertyId)}/inventory-calendar?start_date=${calendarStartDate}&end_date=${inventoryEndDate}`,
            ).catch(() => ({ dates: [] })),
            fetchJson(
              `/inventory/calendar?property_id=${encodeURIComponent(resolvedPropertyId)}&start_date=${calendarStartDate}&days=${totalDays}`,
            ).catch(() => ({ rows: [] })),
            fetchJson(
              `/search/available-dates?property_id=${encodeURIComponent(resolvedPropertyId)}&start_date=${calendarStartDate}&days=${totalDays}`,
            ).catch(() => ({ property: null, availability: [] })),
          ]);

        if (ignore) {
          return;
        }

        const calendarByRateId = Object.fromEntries(
          (data.rate_plans || []).map((ratePlan) => [
            ratePlan.rate_id,
            ratePlan.calendar || [],
          ]),
        );

        setPropertyName(data.property?.name || resolvedPropertyId);
        setRooms(data.rooms || []);
        setRows(
          buildRowsFromApi(
            data.rooms || [],
            data.rate_plans || [],
            calendarByRateId,
            calendarStartDate,
            totalDays,
            inventoryBoardData?.rows || [],
          ),
        );
        const nextInventoryDates =
          Array.isArray(inventoryData?.dates) && inventoryData.dates.length
            ? inventoryData.dates
            : buildHotelSummaryFallback(
                data.rooms || [],
                data.rate_plans || [],
                calendarStartDate,
                totalDays,
                inventoryBoardData?.rows || [],
              );
        setInventoryDates(nextInventoryDates);
        setAvailableDates(normalizeAvailableDatesResponse(availableDatesData));
        setApiConnected(true);
        setPublishError("");
      } catch {
        if (!ignore) {
          setApiConnected(false);
          setRows([]);
          setRooms([]);
          setInventoryDates([]);
          setAvailableDates([]);
          setPropertyName("Selected Property");
          setAvailabilityStatuses([]);
          setMealPlans([]);
          setBedTypes([]);
        }
      } finally {
        if (!ignore) {
          setLoadingRates(false);
        }
      }
    }

    loadRates();
    return () => {
      ignore = true;
    };
  }, [propertyId, calendarStartDate, range, totalDays, days]);

  useEffect(() => {
    setBulkForm((current) => {
      const nextRateId = rows[0]?.code || "";
      const hasSelectedRow = rows.some((row) => row.code === current.rate_id);
      return {
        ...current,
        rate_id: hasSelectedRow ? current.rate_id : nextRateId,
        start_date: current.start_date || calendarStartDate,
        end_date: current.end_date || calendarStartDate,
      };
    });
  }, [rows, calendarStartDate]);

  const pendingChanges = useMemo(() => {
    const visiblePending = rows.reduce((count, row) => {
      return count + row.cells.filter((cell) => cell.changed).length;
    }, 0);

    const queuedPending = Object.values(queuedCalendarUpdates).reduce(
      (count, rateUpdates) => count + Object.keys(rateUpdates || {}).length,
      0,
    );

    return visiblePending + queuedPending;
  }, [queuedCalendarUpdates, rows]);
  const liveRoomIds = useMemo(
    () =>
      new Set(
        rooms
          .filter(
            (room) =>
              String(room.room_status || "").toUpperCase() === liveRoomStatus,
          )
          .map((room) => room.room_id),
      ),
    [rooms, liveRoomStatus],
  );
  const availableRows = useMemo(
    () => rows.filter((row) => liveRoomIds.has(row.roomId)),
    [liveRoomIds, rows],
  );
  const filteredAvailableRows = useMemo(() => {
    const query = rateMatrixSearch.trim().toLowerCase();
    if (!query) {
      return availableRows;
    }
    return availableRows.filter((row) =>
      [row.code, row.title, row.roomLabel, row.roomId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [availableRows, rateMatrixSearch]);
  const roomList = useMemo(() => {
    return rooms
      .filter(
        (room) =>
          String(room.room_status || "").toUpperCase() === liveRoomStatus,
      )
      .map((room) => {
        const linkedRatePlans = rows.filter(
          (row) => row.roomId === room.room_id,
        );
        return {
          ...room,
          linked_rate_plan_count: linkedRatePlans.length,
          active_rate_plan_count: linkedRatePlans.filter((row) => !row.stopSell)
            .length,
          preview_rate_plan: linkedRatePlans[0] || null,
          linked_rate_plans: linkedRatePlans,
        };
      });
  }, [rooms, rows, liveRoomStatus]);

  useEffect(() => {
    if (
      !autoOpenCreateRate ||
      !initialRoomId ||
      autoOpenedRateModalRef.current
    ) {
      return;
    }

    if (!roomList.length) {
      return;
    }

    const targetRoom = roomList.find((room) => room.room_id === initialRoomId);
    if (!targetRoom) {
      return;
    }

    autoOpenedRateModalRef.current = true;
    openRatePlanModal(targetRoom);
  }, [autoOpenCreateRate, initialRoomId, roomList]);
  const selectedDay = visibleDays[selectedDateIndex] || visibleDays[0] || null;
  const selectedStayDate = selectedDay?.isoDate || "";
  const selectedDateSummary = useMemo(() => {
    if (!selectedStayDate) {
      return { queued: 0, booked: 0, blocked: 0 };
    }

    return filteredAvailableRows.reduce(
      (summary, row) => {
        const cell = row.cells.find(
          (item) => item.stay_date === selectedStayDate,
        );
        if (!cell) {
          return summary;
        }

        if (cell.changed) {
          summary.queued += 1;
        }
        if (["BOOKED", "PROSSING", "CTA", "CTD"].includes(cell.availability)) {
          summary.booked += 1;
        }
        if (
          [
            "UNAVAILABLE",
            "STOP_SELL",
            "OUT_OF_ORDER",
            "OUT_OF_SERVICE",
            "OVERBOOKED",
            "AB-UNAVAILABLE",
          ].includes(cell.availability)
        ) {
          summary.blocked += 1;
        }
        return summary;
      },
      { queued: 0, booked: 0, blocked: 0 },
    );
  }, [filteredAvailableRows, selectedStayDate]);
  const inventorySummaryByDate = useMemo(
    () => new Map(inventoryDates.map((item) => [item.stay_date, item])),
    [inventoryDates],
  );
  const visibleInventorySummary = useMemo(
    () =>
      visibleDays.map((day) => ({
        stay_date: day.isoDate,
        total_active_room: 0,
        total_active_rate: 0,
        booked_room: 0,
        available_room: 0,
        unavailable_room: 0,
        ...(inventorySummaryByDate.get(day.isoDate) || {}),
      })),
    [inventorySummaryByDate, visibleDays],
  );

  function handleSelectedDateChange(value) {
    if (!value) {
      return;
    }

    const start = parseCalendarDate(calendarStartDate);
    const next = parseCalendarDate(value);
    const diff = Math.floor(
      (next.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diff >= 0 && diff < totalDays) {
      setSelectedDateIndex(Math.min(diff, totalDays - 1));
      return;
    }

    // jump to the 1st of the selected date's month
    setCalendarStartDate(getMonthStartIsoDate(next));
    setSelectedDateIndex(0);
  }

  async function refreshDailyRates(propertyIdOverride) {
    const resolvedPropertyId =
      propertyIdOverride || selectedProperty || propertyId || "";
    if (!resolvedPropertyId) {
      setRows([]);
      setRooms([]);
      setInventoryDates([]);
      setPropertyName("Selected Property");
      setBedTypes([]);
      setApiConnected(false);
      return;
    }

    const inventoryEndDate =
      days[Math.max(totalDays - 1, 0)]?.isoDate || calendarStartDate;
    const [data, inventoryData, inventoryBoardData, availableDatesData] =
      await Promise.all([
        fetchJson(
          `/rate-plans/daily-rates?property_id=${encodeURIComponent(resolvedPropertyId)}&days=${totalDays}&start_date=${calendarStartDate}`,
        ),
        fetchJson(
          `/properties/${encodeURIComponent(resolvedPropertyId)}/inventory-calendar?start_date=${calendarStartDate}&end_date=${inventoryEndDate}`,
        ).catch(() => ({ dates: [] })),
        fetchJson(
          `/inventory/calendar?property_id=${encodeURIComponent(resolvedPropertyId)}&start_date=${calendarStartDate}&days=${totalDays}`,
        ).catch(() => ({ rows: [] })),
        fetchJson(
          `/search/available-dates?property_id=${encodeURIComponent(resolvedPropertyId)}&start_date=${calendarStartDate}&days=${totalDays}`,
        ).catch(() => ({ property: null, availability: [] })),
      ]);
    const calendarByRateId = Object.fromEntries(
      (data.rate_plans || []).map((ratePlan) => [
        ratePlan.rate_id,
        ratePlan.calendar || [],
      ]),
    );
    setPropertyName(data.property?.name || resolvedPropertyId);
    setRooms(data.rooms || []);
    setRows(
      buildRowsFromApi(
        data.rooms || [],
        data.rate_plans || [],
        calendarByRateId,
        calendarStartDate,
        totalDays,
        inventoryBoardData?.rows || [],
      ),
    );
    const nextInventoryDates =
      Array.isArray(inventoryData?.dates) && inventoryData.dates.length
        ? inventoryData.dates
        : buildHotelSummaryFallback(
            data.rooms || [],
            data.rate_plans || [],
            calendarStartDate,
            totalDays,
            inventoryBoardData?.rows || [],
          );
    setInventoryDates(nextInventoryDates);
    setAvailableDates(normalizeAvailableDatesResponse(availableDatesData));
    setApiConnected(true);
  }

  function handleMatrixMouseDown(event) {
    if (event.button !== 0) {
      return;
    }
    if (event.target.closest("input, select, button, textarea, option")) {
      return;
    }
    const container = matrixScrollRef.current;
    if (!container) {
      return;
    }
    matrixDragRef.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: container.scrollLeft,
    };
  }

  function handleMatrixMouseMove(event) {
    const container = matrixScrollRef.current;
    const drag = matrixDragRef.current;
    if (!container || !drag.active) {
      return;
    }
    event.preventDefault();
    const deltaX = event.clientX - drag.startX;
    container.scrollLeft = drag.scrollLeft - deltaX;
  }

  function handleMatrixMouseUp() {
    matrixDragRef.current.active = false;
  }

  function renderInventoryStyleRateCell(row, cell, index) {
    const cellRate =
      cell.base_rate ?? formatRateValue(parseRateValue(cell.value));
    const cellAvailability = cell.availability || "";
    const availabilityLabel = getAvailabilityDisplayLabel(cellAvailability);
    const isUnavailable = isUnavailableAvailability(cellAvailability);
    const isAvailable = !isUnavailable && Boolean(cellAvailability);
    const isSelected = index === selectedDateIndex;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = new Date(cell.stay_date + "T00:00:00") < today;
    const isWeekend = (() => {
      const d = new Date(cell.stay_date + "T00:00:00");
      const day = d.getDay();
      return day === 0 || day === 6;
    })();

    const cellBg = isSelected
      ? isSoftLightTheme
        ? "rgba(116,43,101,0.10)"
        : isDarkTheme || isMidnightTheme
          ? "rgba(99,102,241,0.10)"
          : "rgba(15,23,42,0.06)"
      : isWeekend
        ? matrixThemeStyles.subHeader.background
        : "transparent";

    const innerBorderColor = isPast
      ? "rgba(148,163,184,0.12)"
      : isUnavailable
        ? "rgba(244,63,94,0.30)"
        : isAvailable
          ? "rgba(16,185,129,0.36)"
          : "rgba(148,163,184,0.18)";

    const innerBg = isPast
      ? isDarkTheme || isMidnightTheme
        ? "linear-gradient(135deg,rgba(148,163,184,0.05) 0%,rgba(15,23,42,0.02) 100%)"
        : "linear-gradient(135deg,rgba(148,163,184,0.08) 0%,rgba(255,255,255,0.04) 100%)"
      : isUnavailable
        ? isSoftLightTheme
          ? "linear-gradient(135deg,rgba(255,200,210,0.28) 0%,rgba(255,255,255,0.10) 100%)"
          : isDarkTheme || isMidnightTheme
            ? "linear-gradient(135deg,rgba(244,63,94,0.18) 0%,rgba(15,23,42,0.06) 100%)"
            : "linear-gradient(135deg,rgba(255,228,230,0.60) 0%,rgba(255,255,255,0.40) 100%)"
        : isAvailable
          ? isSoftLightTheme
            ? "linear-gradient(135deg,rgba(16,185,129,0.18) 0%,rgba(255,255,255,0.10) 100%)"
            : isDarkTheme || isMidnightTheme
              ? "linear-gradient(135deg,rgba(16,185,129,0.16) 0%,rgba(15,23,42,0.06) 100%)"
              : "linear-gradient(135deg,rgba(209,250,229,0.60) 0%,rgba(255,255,255,0.40) 100%)"
          : isSoftLightTheme
            ? "linear-gradient(135deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%)"
            : isDarkTheme || isMidnightTheme
              ? "linear-gradient(135deg,rgba(148,163,184,0.08) 0%,rgba(15,23,42,0.04) 100%)"
              : "linear-gradient(135deg,rgba(248,250,252,0.80) 0%,rgba(255,255,255,0.60) 100%)";

    const rateTextColor = isPast
      ? isDarkTheme || isMidnightTheme
        ? "#475569"
        : "#cbd5e1"
      : isUnavailable
        ? isSoftLightTheme
          ? "#b45563"
          : isDarkTheme || isMidnightTheme
            ? "#fca5a5"
            : "#e11d48"
        : isAvailable
          ? isSoftLightTheme
            ? "#065f46"
            : isDarkTheme || isMidnightTheme
              ? "#6ee7b7"
              : "#059669"
          : isSoftLightTheme
            ? "#6f2f62"
            : isDarkTheme || isMidnightTheme
              ? "#e2e8f0"
              : "#0f172a";

    return (
      <div
        key={`${row.code}-cell-${index}`}
        className="p-1"
        style={{
          borderRight: "1px solid rgba(148,163,184,0.12)",
          background: cellBg,
          opacity: isPast ? 0.45 : 1,
          pointerEvents: isPast ? "none" : "auto",
        }}
      >
        <button
          type="button"
          disabled={isPast}
          className="flex h-full w-full flex-col items-center justify-center rounded-sm border transition-all duration-150 hover:scale-[1.02] hover:brightness-105 disabled:cursor-not-allowed"
          style={{
            minHeight: "48px",
            borderColor: innerBorderColor,
            background: innerBg,
            boxShadow: isSelected
              ? "0 0 0 1px rgba(99,102,241,0.18), 0 0 0 3px rgba(99,102,241,0.08)"
              : "0 0 0 1px rgba(255,255,255,0.10)",
          }}
          onClick={(event) => {
            const anchor = event.currentTarget;
            const rect = anchor.getBoundingClientRect();
            const popupWidth = 240;
            const left = Math.max(
              16,
              Math.min(rect.right + 10, window.innerWidth - popupWidth - 16),
            );
            const top = Math.max(
              16,
              Math.min(rect.top, window.innerHeight - 240),
            );
            setSummaryPopover(null);
            setCellPopover((current) =>
              current?.rateId === row.code &&
              current?.stayDate === cell.stay_date
                ? null
                : {
                    anchorEl: anchor,
                    rateId: row.code,
                    stayDate: cell.stay_date,
                    left,
                    top,
                    rowTitle: row.title,
                    cellRate,
                    cellAvailability,
                    availabilityLabel,
                  },
            );
          }}
        >
          <span
            className="text-[11px] font-bold leading-none"
            style={{ color: rateTextColor }}
          >
            {formatDisplayRateValue(cellRate)}
          </span>
          {cellAvailability ? (
            <span
              className="mt-1 text-[8px] font-bold uppercase tracking-wider"
              style={{
                color: isUnavailable
                  ? isSoftLightTheme
                    ? "#b45563"
                    : isDarkTheme || isMidnightTheme
                      ? "#fca5a5"
                      : "#e11d48"
                  : isSoftLightTheme
                    ? "#065f46"
                    : isDarkTheme || isMidnightTheme
                      ? "#6ee7b7"
                      : "#059669",
              }}
            >
              {isUnavailable ? "N/A" : "OK"}
            </span>
          ) : null}
        </button>
      </div>
    );
  }

  function openRatePlanModal(room) {
    if (String(room?.room_status || "").toUpperCase() !== liveRoomStatus) {
      setRoomListMessage("Rate plans can be created only for live rooms.");
      return;
    }
    setSelectedRoomForRatePlan(room);
    setSelectedRoomSummary(null);
    setRatePlanModalMode("create");
    setEditingRatePlanId("");
    setNewRatePlanForm(createRatePlanForm(room));
    setRatePlanModalError("");
    setRatePlanModalSuccess("");
    setShowRatePlanModal(true);
  }

  function closeRatePlanModal() {
    const roomPlansContext =
      ratePlanModalMode === "edit" && selectedRoomForRatePlan?.room_id
        ? selectedRoomForRatePlan
        : null;

    setShowRatePlanModal(false);
    setSelectedRoomForRatePlan(null);
    setSelectedRoomSummary(null);
    setRatePlanModalMode("create");
    setEditingRatePlanId("");
    setRatePlanModalError("");
    setRatePlanModalSuccess("");
    setLoadingRatePlanDetails(false);
    setLoadingRoomSummary(false);
    setNewRatePlanForm(createRatePlanForm(null));

    if (roomPlansContext) {
      setActiveRoomPlansModal(roomPlansContext);
    }

    if (autoOpenCreateRate) {
      const nextUrl = selectedProperty
        ? `/daily-rates?property_id=${encodeURIComponent(selectedProperty)}`
        : "/daily-rates";
      router.replace(nextUrl);
    }
  }

  function openActiveRoomPlansModal(room) {
    setActiveRoomPlansModal(room);
  }

  function closeActiveRoomPlansModal() {
    setActiveRoomPlansModal(null);
  }

  async function openEditRatePlanModal(room, plan) {
    if (!plan?.code) {
      return;
    }

    setSelectedRoomForRatePlan(room);
    setSelectedRoomSummary(null);
    setRatePlanModalMode("edit");
    setEditingRatePlanId(plan.code);
    setRatePlanModalError("");
    setRatePlanModalSuccess("");
    setLoadingRatePlanDetails(true);
    setShowRatePlanModal(true);
    closeActiveRoomPlansModal();

    try {
      const ratePlan = await fetchJson(
        `/rate-plans/${encodeURIComponent(plan.code)}`,
      );
      setNewRatePlanForm(createRatePlanFormFromDetails(room, ratePlan));
    } catch (error) {
      setRatePlanModalError(
        error.message || `Could not load rate plan ${plan.code}.`,
      );
    } finally {
      setLoadingRatePlanDetails(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function loadRoomSummary() {
      if (!showRatePlanModal || !selectedRoomForRatePlan?.room_id) {
        setSelectedRoomSummary(null);
        setLoadingRoomSummary(false);
        return;
      }

      setLoadingRoomSummary(true);

      try {
        const roomDetail = await fetchJson(
          `/rooms/${encodeURIComponent(selectedRoomForRatePlan.room_id)}`,
        );
        if (!ignore) {
          setSelectedRoomSummary(roomDetail);
        }
      } catch {
        if (!ignore) {
          setSelectedRoomSummary(null);
        }
      } finally {
        if (!ignore) {
          setLoadingRoomSummary(false);
        }
      }
    }

    loadRoomSummary();

    return () => {
      ignore = true;
    };
  }, [showRatePlanModal, selectedRoomForRatePlan?.room_id]);

  async function handleSubmitRatePlan(event) {
    event.preventDefault();

    if (!newRatePlanForm.room_id) {
      setRatePlanModalError("Select a room first.");
      return;
    }

    if (
      String(selectedRoomForRatePlan?.room_status || "").toUpperCase() !==
      liveRoomStatus
    ) {
      setRatePlanModalError("Rate plans can be created only for live rooms.");
      return;
    }

    setSavingNewRatePlan(true);
    setRatePlanModalError("");
    setRatePlanModalSuccess("");

    try {
      const isEditMode = ratePlanModalMode === "edit" && editingRatePlanId;
      await fetchJson(
        isEditMode
          ? `/rate-plans/${encodeURIComponent(editingRatePlanId)}`
          : "/rate-plans",
        {
          method: isEditMode ? "PATCH" : "POST",
          body: JSON.stringify(createRatePlanPayload(newRatePlanForm)),
        },
      );

      await refreshDailyRates(
        newRatePlanForm.room_id ? selectedProperty : undefined,
      );
      setRoomListMessage(
        isEditMode
          ? `Updated rate plan ${editingRatePlanId}.`
          : `Added a new rate plan for ${newRatePlanForm.room_id}.`,
      );
      closeRatePlanModal();
    } catch (error) {
      setRatePlanModalError(
        error.message ||
          (ratePlanModalMode === "edit"
            ? "Could not update the rate plan."
            : "Could not create the rate plan."),
      );
    } finally {
      setSavingNewRatePlan(false);
    }
  }

  async function handleRemoveRatePlan(row) {
    if (!row?.code || deletingRateId) {
      return;
    }

    const hasPendingChanges = row.cells.some((cell) => cell.changed);
    const confirmationMessage = hasPendingChanges
      ? `Remove rate plan ${row.code}? Pending calendar changes for this plan will be lost.`
      : `Remove rate plan ${row.code}?`;

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setDeletingRateId(row.code);
    setPublishError("");
    setPublishSuccess("");
    setBulkError("");
    setBulkSuccess("");

    try {
      await fetchJson(`/rate-plans/${encodeURIComponent(row.code)}`, {
        method: "DELETE",
      });

      await refreshDailyRates(selectedProperty || propertyId || "");
      setPublishSuccess(`Removed rate plan ${row.code}.`);
    } catch (error) {
      setPublishError(
        error.message || `Could not remove rate plan ${row.code}.`,
      );
    } finally {
      setDeletingRateId("");
    }
  }

  function updateCell(rateId, stayDate, updates) {
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.code !== rateId) {
          return row;
        }

        return {
          ...row,
          cells: row.cells.map((cell, index) => {
            if (cell.stay_date !== stayDate) {
              return cell;
            }

            const nextCell = {
              ...cell,
              ...updates,
            };
            const nextBaseRate = formatRateValue(nextCell.base_rate);
            const nextAvailability = nextCell.availability || "";

            return {
              ...nextCell,
              base_rate: nextBaseRate,
              availability: nextAvailability,
              changed:
                nextBaseRate !== formatRateValue(nextCell.original_base_rate) ||
                nextAvailability !== nextCell.original_availability,
              note: getCellNote(nextAvailability, index),
              tone: getTone(
                {
                  availability: nextAvailability,
                  base_rate: Number(nextBaseRate),
                },
                index,
              ),
            };
          }),
        };
      }),
    );
  }

  function shiftCalendar(daysToShift) {
    const current = parseCalendarDate(calendarStartDate);
    // shift by months: positive = next month, negative = prev month
    const months = daysToShift > 0 ? 1 : -1;
    const next = new Date(
      current.getFullYear(),
      current.getMonth() + months,
      1,
    );
    setCalendarStartDate(getMonthStartIsoDate(next));
    setSelectedDateIndex(0);
  }

  function applyBulkChanges(event) {
    event.preventDefault();

    if (!bulkForm.rate_id) {
      setBulkError("Select a rate plan first.");
      return;
    }

    if (!bulkForm.start_date || !bulkForm.end_date) {
      setBulkError("Choose both a start and end date.");
      return;
    }

    if (bulkForm.start_date > bulkForm.end_date) {
      setBulkError("Bulk start date must be before end date.");
      return;
    }

    const selectedDates = enumerateDateRange(
      bulkForm.start_date,
      bulkForm.end_date,
    );
    const selectedDateSet = new Set(selectedDates);

    if (selectedDates.length > 366) {
      setBulkError("Bulk Editor supports up to 1 year per update.");
      return;
    }

    if (!bulkForm.base_rate.trim() && !bulkForm.availability.trim()) {
      setBulkError("Enter a rate, availability, or both for the bulk update.");
      return;
    }

    const targetRow = rows.find((row) => row.code === bulkForm.rate_id);
    if (!targetRow) {
      setBulkError("Selected rate plan is not loaded.");
      return;
    }

    const visibleDates = new Set(targetRow.cells.map((cell) => cell.stay_date));
    const queuedOnlyDates = selectedDates.filter(
      (date) => !visibleDates.has(date),
    );
    const queuedOnlyCount = queuedOnlyDates.length;

    if (queuedOnlyDates.length && !bulkForm.base_rate.trim()) {
      setBulkError(
        "Enter a base rate when updating dates outside the visible calendar window.",
      );
      return;
    }

    let updatedCount = 0;
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.code !== bulkForm.rate_id) {
          return row;
        }

        return {
          ...row,
          cells: row.cells.map((cell, index) => {
            if (!selectedDateSet.has(cell.stay_date)) {
              return cell;
            }

            updatedCount += 1;
            const nextBaseRate = bulkForm.base_rate.trim()
              ? formatRateValue(parseRateValue(bulkForm.base_rate))
              : cell.base_rate;
            const nextAvailability = bulkForm.availability || cell.availability;

            return {
              ...cell,
              base_rate: nextBaseRate,
              availability: nextAvailability,
              changed:
                nextBaseRate !== formatRateValue(cell.original_base_rate) ||
                nextAvailability !== cell.original_availability,
              note: getCellNote(nextAvailability, index),
              tone: getTone(
                {
                  availability: nextAvailability,
                  base_rate: Number(nextBaseRate),
                },
                index,
              ),
            };
          }),
        };
      }),
    );

    if (queuedOnlyCount) {
      const sampleCell = targetRow.cells[0];
      const defaultCurrency = sampleCell?.currency || "USD";
      const defaultTax = Number(sampleCell?.tax || 0);
      const nextBaseRate = formatRateValue(parseRateValue(bulkForm.base_rate));
      const nextAvailability = bulkForm.availability || "";

      setQueuedCalendarUpdates((current) => {
        const currentRateUpdates = current[bulkForm.rate_id] || {};
        const nextRateUpdates = { ...currentRateUpdates };

        queuedOnlyDates.forEach((stayDate) => {
          nextRateUpdates[stayDate] = {
            stay_date: stayDate,
            currency: defaultCurrency,
            base_rate: Number(nextBaseRate),
            tax: defaultTax,
            availability: nextAvailability,
          };
        });

        return {
          ...current,
          [bulkForm.rate_id]: nextRateUpdates,
        };
      });

      updatedCount += queuedOnlyCount;
    }

    setBulkError("");
    setBulkSuccess(
      updatedCount
        ? `Queued ${updatedCount} calendar cells for update.`
        : "No cells matched the selected range.",
    );
    setPublishSuccess("");
  }

  async function publishChanges() {
    if (!pendingChanges) {
      setPublishError("There are no pending calendar changes to publish.");
      return;
    }

    setPublishing(true);
    setPublishError("");
    setPublishSuccess("");
    setBulkSuccess("");

    try {
      const payloadsByRateId = rows.reduce((groups, row) => {
        const changedItems = row.cells
          .filter((cell) => cell.changed)
          .map((cell) => ({
            stay_date: cell.stay_date,
            currency: cell.currency || "USD",
            base_rate: Number(cell.base_rate),
            tax: Number(cell.tax || 0),
            availability: cell.availability,
          }));

        if (changedItems.length) {
          groups[row.code] = Object.fromEntries(
            changedItems.map((item) => [item.stay_date, item]),
          );
        }

        return groups;
      }, {});

      Object.entries(queuedCalendarUpdates).forEach(([rateId, itemsByDate]) => {
        const existingItems = payloadsByRateId[rateId] || {};
        payloadsByRateId[rateId] = {
          ...existingItems,
          ...itemsByDate,
        };
      });

      await Promise.all(
        Object.entries(payloadsByRateId).map(([rateId, itemsByDate]) =>
          fetchJson(`/rate-plans/${rateId}/calendar/bulk-upsert`, {
            method: "POST",
            body: JSON.stringify({ items: Object.values(itemsByDate) }),
          }),
        ),
      );

      setPublishSuccess(
        `Published ${pendingChanges} calendar change${pendingChanges === 1 ? "" : "s"}.`,
      );

      setQueuedCalendarUpdates({});
      await refreshDailyRates(selectedProperty || propertyId || "");
    } catch (error) {
      setPublishError(error.message || "Could not publish calendar changes.");
    } finally {
      setPublishing(false);
    }
  }

  const summaryStats = useMemo(() => {
    const visibleRows = availableRows.length
      ? availableRows
      : apiConnected
        ? []
        : fallbackRows;
    const allCells = visibleRows.flatMap((row) =>
      row.cells.slice(0, totalDays),
    );
    const numericRates = allCells
      .map((cell) =>
        Number(cell.base_rate ?? String(cell.value).replace(/[^0-9.]/g, "")),
      )
      .filter((value) => !Number.isNaN(value) && value > 0);
    const adr = numericRates.length
      ? numericRates.reduce((sum, value) => sum + value, 0) /
        numericRates.length
      : 0;

    return [
      // {
      //   label: "Publish Queue",
      //   value: `${pendingChanges} changes`,
      //   note: apiConnected ? "Editable calendar cells waiting to publish." : "Static demo queue",
      //   icon: "publish",
      //   tone: "primary",
      // },
      // {
      //   label: "ADR Window",
      //   value: `$${adr.toFixed(2)}`,
      //   note: `${visibleRows.length} room groups in view`,
      //   icon: "payments",
      //   tone: "emerald",
      // },
      // {
      //   label: "Low Availability",
      //   value: `${allCells.filter((cell) => ["BOOKED", "PROSSING", "CTA", "CTD"].includes(cell.availability)).length} days`,
      //   note: "Potential pressure dates in selected view",
      //   icon: "trending_up",
      //   tone: "amber",
      // },
      // {
      //   label: "Restriction Flags",
      //   value: `${visibleRows.filter((row) => row.stopSell || row.cta || row.ctd).length} plans`,
      //   note: "CTA, CTD, or stop-sell enabled",
      //   icon: "rule_settings",
      //   tone: "blue",
      // },
    ];
  }, [apiConnected, availableRows, pendingChanges, range]);

  const insightCards = useMemo(
    () => [
      //     {
      //       title: "API Connection",
      //       items: [
      //         apiConnected ? "Connected to FastAPI backend." : "Backend not reachable, showing local fallback data.",
      //         `Loaded ${properties.length || 1} properties and ${rooms.length || availableRows.length} room records.`,
      //         apiConnected ? "Single-day and bulk calendar edits publish through `/rate-plans/{rate_id}/calendar/bulk-upsert`." : "Start the backend to hydrate this matrix with live data.",
      //       ],
      //     },
      // {
      //   title: "Active Property",
      //   items: [
      //     `Property: ${selectedProperty || "Not selected"}`,
      //     `${rooms.length} rooms fetched for rate review.`,
      //     `Calendar start: ${calendarStartDate}`,
      //   ],
      // },
    ],
    [
      apiConnected,
      availableRows.length,
      calendarStartDate,
      properties.length,
      rooms.length,
      selectedProperty,
    ],
  );

  const availabilityOptions = useMemo(() => {
    return [
      { value: "AVAILABLE", label: "AVAILABLE", description: "" },
      { value: "UNAVAILABLE", label: "UNAVAILABLE", description: "" },
    ];
  }, [availabilityStatuses]);

  const mealPlanOptions = useMemo(() => {
    if (mealPlans.length) {
      return mealPlans.map((mealPlan) => ({
        value: mealPlan.code,
        label: mealPlan.title || mealPlan.code,
      }));
    }

    return [
      { value: "RO", label: "Room Only" },
      { value: "BB", label: "Bed & Breakfast" },
      { value: "HB", label: "Half Board" },
      { value: "FB", label: "Full Board" },
      { value: "AI", label: "All Inclusive" },
    ];
  }, [mealPlans]);

  const bedTypeOptions = useMemo(() => {
    if (bedTypes.length) {
      return bedTypes.map((bedType) => ({
        value: bedType.code,
        label: bedType.title || bedType.code,
      }));
    }

    return [
      { value: "SB", label: "Single Bed" },
      { value: "DB", label: "Double Bed" },
      { value: "TB", label: "Twin Beds" },
      { value: "QB", label: "Queen Bed" },
      { value: "KB", label: "King Bed" },
    ];
  }, [bedTypes]);

  return (
    <PmsShell
      searchPlaceholder="Search rooms or guests..."
      sidebarMetricLabel="Rate Plans Loaded"
      sidebarMetricValue={`${availableRows.length}`}
      sidebarMetricProgress={Math.max(
        20,
        Math.min(100, availableRows.length * 20),
      )}
    >
      {!hasSelectedProperty ? (
        <section className="mb-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <span className="material-symbols-outlined text-4xl text-slate-400">
            sell
          </span>
          <h3 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Select a property first
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Open daily rates with a `property_id` to view and manage rate plans
            for a property.
          </p>
          <div className="mt-6 flex justify-center">
            <a
              href="/properties"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined text-base">
                arrow_back
              </span>
              Go to Properties
            </a>
          </div>
        </section>
      ) : (
        <>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                <span className="material-symbols-outlined text-base">
                  sell
                </span>
                Revenue Control Desk
              </div>
              <h2 className="text-xl font-bold tracking-tight">
                Daily Rates &amp; Yield
              </h2>
              <p className="max-w-xl text-sm text-slate-500">
                This screen now consumes a property-level FastAPI daily-rates
                feed and shows all rooms with their linked rate plans.
              </p>
            </div>
            <div className="flex gap-3">
              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-all",
                  pendingChanges > 0
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700",
                ].join(" ")}
              >
                <span className="material-symbols-outlined text-base">
                  {apiConnected ? "hub" : "cloud_off"}
                </span>
                {loadingRates
                  ? "Refreshing..."
                  : apiConnected
                    ? "FastAPI Live"
                    : "Fallback Mode"}
              </span>
            </div>
          </div>

          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryStats.map((stat) => (
              <StatCard key={stat.label} stat={stat} />
            ))}
          </section>

          <section className="mb-6 space-y-4">
            {/* <div className="grid gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">
                Property:{" "}
                <span className="font-bold text-slate-900">
                  {selectedProperty || "Not selected"}
                </span>
              </div>
              <label className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">
                <span className="mr-2">Switch:</span>
                <select
                  value={selectedProperty}
                  onChange={(event) => {
                    const nextPropertyId = event.target.value;
                    setSelectedProperty(nextPropertyId);
                    router.push(`/daily-rates?property_id=${encodeURIComponent(nextPropertyId)}`);
                  }}
                  className="bg-transparent font-bold text-slate-900 outline-none"
                >
                  {properties.map((property) => (
                    <option key={property.property_id} value={property.property_id}>
                      {property.property_id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">
                Rooms Loaded:{" "}
                <span className="font-bold text-slate-900">{rooms.length || rows.length}</span>
              </div>
              <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">
                Rate Plans: <span className="font-bold text-slate-900">{availableRows.length}</span>
              </div>
              <label className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600">
                <span className="mr-2">Start:</span>
                <input
                  type="date"
                  value={calendarStartDate}
                  onChange={(event) => setCalendarStartDate(event.target.value)}
                  className="bg-transparent font-bold text-slate-900 outline-none"
                />
              </label>
              <div className="ml-auto flex items-center gap-2">
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => shiftCalendar(-range)}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftCalendar(range)}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Debug APIs</h3>
                <p className="mt-1 text-xs text-slate-500">
                  APIs used by the Rate Matrix section.
                </p>
              </div>
              <span className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Debug
              </span>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="rounded-xl border border-amber-200 bg-white px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Main matrix data</p>
                <p className="mt-1 font-mono text-xs text-slate-700">
                  /api/v1/rate-plans/daily-rates?property_id=...&days=30&start_date=...
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-white px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Hotel Summary row</p>
                <p className="mt-1 font-mono text-xs text-slate-700">
                  /api/v1/properties/{'{property_id}'}/inventory-calendar?start_date=...&end_date=...
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-white px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Booking overlay / booked room info</p>
                <p className="mt-1 font-mono text-xs text-slate-700">
                  /api/v1/inventory/calendar?property_id=...&start_date=...&days=...
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-white px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Available dates helper</p>
                <p className="mt-1 font-mono text-xs text-slate-700">
                  /api/v1/search/available-dates?property_id=...&start_date=...&days=...
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-white px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Dropdown / metadata</p>
                <p className="mt-1 font-mono text-xs text-slate-700">/api/v1/rate-plans/availability-statuses</p>
                <p className="mt-1 font-mono text-xs text-slate-700">/api/v1/feature/meal-plans</p>
                <p className="mt-1 font-mono text-xs text-slate-700">/api/v1/feature/bed-type</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-white px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Rate create / update / delete</p>
                <p className="mt-1 font-mono text-xs text-slate-700">POST /api/v1/rate-plans</p>
                <p className="mt-1 font-mono text-xs text-slate-700">PATCH /api/v1/rate-plans/{'{rate_id}'}</p>
                <p className="mt-1 font-mono text-xs text-slate-700">DELETE /api/v1/rate-plans/{'{rate_id}'}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-white px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Rate calendar save</p>
                <p className="mt-1 font-mono text-xs text-slate-700">POST /api/v1/rate-plans/{'{rate_id}'}/calendar/bulk-upsert</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-white px-3 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Full rate details for edit modal</p>
                <p className="mt-1 font-mono text-xs text-slate-700">GET /api/v1/rate-plans/{'{rate_id}'}</p>
              </div>
            </div>
          </div>
        </div> */}

            <div className="grid items-stretch gap-4 xl:grid-cols-[2fr_1fr]">
              <article
                className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                style={softLightGlassCardStyle}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Active Room List
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Only live rooms are shown here and only live rooms can
                      receive rate plans.
                    </p>
                  </div>
                  <div
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                    style={softLightGlassInsetStyle}
                  >
                    {roomList.length} rooms
                  </div>
                </div>
                {roomListMessage ? (
                  <p className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                    {roomListMessage}
                  </p>
                ) : null}
                <div className="mt-4 space-y-3">
                  {roomList.map((room) => (
                    <div
                      key={room.room_id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                      style={softLightGlassInsetStyle}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          {room.room_name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[
                            room.room_id,
                            `$${Number(room.base_rate || 0).toFixed(2)}`,
                            `${room.linked_rate_plan_count} plans`,
                          ].join(" • ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openActiveRoomPlansModal(room)}
                          className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 shadow-sm transition-opacity hover:opacity-85 dark:bg-emerald-500/15 dark:text-emerald-300"
                        >
                          Active {room.active_rate_plan_count}
                        </button>
                        <button
                          type="button"
                          onClick={() => openRatePlanModal(room)}
                          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
                        >
                          <span className="material-symbols-outlined text-base">
                            edit_square
                          </span>
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                  {!roomList.length ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                      No live rooms found for this property.
                    </div>
                  ) : null}
                </div>
              </article>
              <article
                className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                style={softLightGlassCardStyle}
              >
                <h3 className="text-base font-bold text-slate-900">
                  Bulk Editor
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Queue a date-range update for one rate plan, then publish all
                  pending changes. One bulk action can cover up to 1 year.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { label: "30 Days", days: 30 },
                    { label: "90 Days", days: 90 },
                    { label: "180 Days", days: 180 },
                    { label: "1 Year", days: 365 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        const startDate =
                          bulkForm.start_date ||
                          new Date().toISOString().slice(0, 10);
                        const endDate = new Date(`${startDate}T00:00:00`);
                        endDate.setDate(endDate.getDate() + preset.days - 1);
                        setBulkForm((current) => ({
                          ...current,
                          start_date: startDate,
                          end_date: toIsoDateFromParts(
                            endDate.getFullYear(),
                            endDate.getMonth(),
                            endDate.getDate(),
                          ),
                        }));
                        setBulkError("");
                        setBulkSuccess("");
                      }}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 transition-colors hover:border-primary hover:text-primary"
                      style={softLightGlassInsetStyle}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <form onSubmit={applyBulkChanges} className="mt-4 space-y-3">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Rate Plan
                    </span>
                    <select
                      value={bulkForm.rate_id}
                      onChange={(event) => {
                        setBulkForm((current) => ({
                          ...current,
                          rate_id: event.target.value,
                        }));
                        setBulkError("");
                        setBulkSuccess("");
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                    >
                      <option value="">Select rate plan</option>
                      {availableRows.map((row) => (
                        <option key={row.code} value={row.code}>
                          {row.code} - {row.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Start Date
                      </span>
                      <input
                        type="date"
                        value={bulkForm.start_date}
                        onChange={(event) =>
                          setBulkForm((current) => ({
                            ...current,
                            start_date: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        End Date
                      </span>
                      <input
                        type="date"
                        value={bulkForm.end_date}
                        onChange={(event) =>
                          setBulkForm((current) => ({
                            ...current,
                            end_date: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Base Rate
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={bulkForm.base_rate}
                        onChange={(event) =>
                          setBulkForm((current) => ({
                            ...current,
                            base_rate: event.target.value,
                          }))
                        }
                        placeholder="Leave blank to keep"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Availability
                      </span>
                      <select
                        value={bulkForm.availability}
                        onChange={(event) =>
                          setBulkForm((current) => ({
                            ...current,
                            availability: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                      >
                        <option value="">Keep existing</option>
                        {availabilityOptions.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={!apiConnected || !availableRows.length}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  >
                    {/* <span className="material-symbols-outlined text-base">calendar_edit</span> */}
                    Apply To Range
                  </button>
                </form>
                {bulkError ? (
                  <p className="mt-3 text-sm font-medium text-rose-600">
                    {bulkError}
                  </p>
                ) : null}
                {bulkSuccess ? (
                  <p className="mt-3 text-sm font-medium text-emerald-600">
                    {bulkSuccess}
                  </p>
                ) : null}
              </article>
            </div>
            {insightCards.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {insightCards.map((card) => (
                  <article
                    key={card.title}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    style={softLightGlassCardStyle}
                  >
                    <h3 className="text-base font-bold text-slate-900">
                      {card.title}
                    </h3>
                    <div className="mt-4 space-y-3">
                      {card.items.map((item) => (
                        <div
                          key={item}
                          className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"
                          style={softLightGlassInsetStyle}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <section
            className="sticky top-[73px] z-20 flex h-[calc(100vh-97px)] flex-col overflow-hidden rounded-2xl border"
            style={matrixThemeStyles.panel}
          >
            <div
              className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4"
              style={{
                borderColor: "var(--soft-border)",
                background:
                  "color-mix(in srgb, var(--panel-bg) 82%, transparent)",
              }}
            >
              <div className="flex min-w-0 flex-col">
                <h3
                  className={`text-lg font-bold ${matrixThemeStyles.card.textClass}`}
                >
                  Rate Matrix
                </h3>
                <p
                  className={`text-sm ${matrixThemeStyles.subHeader.subtextClass}`}
                >
                  Edit live-room rates day by day, or queue bulk changes from
                  the editor.
                </p>
              </div>
              <div
                className="flex items-center gap-2 rounded-xl border px-3 py-2 shadow-sm"
                style={{
                  borderColor: "var(--soft-border)",
                  background:
                    "color-mix(in srgb, var(--panel-bg) 90%, transparent)",
                }}
              >
                <button
                  type="button"
                  onClick={() => shiftCalendar(-1)}
                  className={`rounded-lg px-2 py-1 text-sm font-semibold transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 ${matrixThemeStyles.subHeader.subtextClass}`}
                >
                  <span className="material-symbols-outlined text-base">
                    chevron_left
                  </span>
                </button>
                <span
                  className={`min-w-[120px] text-center text-sm font-bold ${matrixThemeStyles.card.textClass}`}
                >
                  {new Date(calendarStartDate + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { month: "long", year: "numeric" },
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => shiftCalendar(1)}
                  className={`rounded-lg px-2 py-1 text-sm font-semibold transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 ${matrixThemeStyles.subHeader.subtextClass}`}
                >
                  <span className="material-symbols-outlined text-base">
                    chevron_right
                  </span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm ${matrixThemeStyles.subHeader.subtextClass}`}
                  style={{
                    borderColor: "var(--soft-border)",
                    background:
                      "color-mix(in srgb, var(--panel-bg) 90%, transparent)",
                  }}
                >
                  <span className="material-symbols-outlined text-base text-slate-400">
                    calendar_month
                  </span>
                  <input
                    type="date"
                    value={selectedStayDate}
                    onChange={(event) =>
                      handleSelectedDateChange(event.target.value)
                    }
                    className={`bg-transparent outline-none ${matrixThemeStyles.card.textClass}`}
                  />
                </label>
                <label
                  className={`flex min-w-[250px] items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm ${matrixThemeStyles.subHeader.subtextClass}`}
                  style={{
                    borderColor: "var(--soft-border)",
                    background:
                      "color-mix(in srgb, var(--panel-bg) 90%, transparent)",
                  }}
                >
                  <span className="material-symbols-outlined text-base text-slate-400">
                    search
                  </span>
                  <input
                    type="text"
                    value={rateMatrixSearch}
                    onChange={(event) =>
                      setRateMatrixSearch(event.target.value)
                    }
                    placeholder="Search rate ID, room name, or room ID"
                    className={`w-full bg-transparent outline-none ${matrixThemeStyles.card.textClass}`}
                  />
                </label>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div
                ref={matrixScrollRef}
                onMouseDown={handleMatrixMouseDown}
                onMouseMove={handleMatrixMouseMove}
                onMouseUp={handleMatrixMouseUp}
                onMouseLeave={handleMatrixMouseUp}
                className="select-none overflow-x-hidden overflow-y-visible"
              >
                <div
                  className="w-full overflow-visible"
                >
                  <div
                    className="sticky top-0 z-30 grid"
                    style={{
                      gridTemplateColumns: matrixGridTemplate,
                      background: matrixThemeStyles.headerRow.background,
                      borderBottom: matrixThemeStyles.headerRow.borderBottom,
                      backdropFilter: "blur(14px)",
                    }}
                  >
                    <div
                      className="sticky left-0 z-40 flex min-h-[76px] items-center px-5 py-4 text-left"
                      style={{
                        borderRight: "1px solid rgba(148, 163, 184, 0.16)",
                        background: isSoftLightTheme
                          ? "rgb(154, 73, 137)"
                          : matrixThemeStyles.headerRow.background,
                        boxShadow: "2px 0 10px rgba(15,23,42,0.08)",
                      }}
                    >
                      <p
                        className={`text-sm font-black uppercase tracking-[0.18em] ${isSoftLightTheme ? "text-white" : matrixThemeStyles.headerRow.labelClass}`}
                      >
                        Rate Plan
                      </p>
                    </div>
                    {visibleDays.map((day, index) => {
                      const isToday = index === 0;
                      const isSelected = index === selectedDateIndex;
                      const weekend =
                        day.shortDay === "Sat" || day.shortDay === "Sun";
                      const isFirstOfMonth = day.dayNum === "01";
                      return (
                        <button
                          type="button"
                          key={day.isoDate}
                          onClick={() => setSelectedDateIndex(index)}
                          className="w-full p-2 text-center"
                          style={{
                            borderRight: "1px solid rgba(148, 163, 184, 0.10)",
                            backgroundColor: isSelected
                              ? isSoftLightTheme
                                ? "rgba(116,43,101,0.12)"
                                : isDarkTheme || isMidnightTheme
                                  ? "rgba(99,102,241,0.10)"
                                  : "rgba(15, 23, 42, 0.06)"
                              : weekend
                                ? isSoftLightTheme
                                  ? "rgba(255,255,255,0.08)"
                                  : isDarkTheme || isMidnightTheme
                                    ? "rgba(255,255,255,0.06)"
                                    : "rgba(248, 250, 252, 0.88)"
                                : "transparent",
                          }}
                        >
                          <div className="flex flex-col items-center">
                            <span
                              className={`font-mono text-[10px] ${matrixThemeStyles.headerRow.labelClass}`}
                            >
                              {day.shortDay.toUpperCase()}
                            </span>
                            <span
                              className={`mt-0.5 text-base font-bold ${matrixThemeStyles.headerRow.textClass}`}
                            >
                              {day.dayNum}
                            </span>
                            {isFirstOfMonth ? (
                              <span
                                className={`mt-0.5 text-[8px] font-bold uppercase tracking-wider ${matrixThemeStyles.headerRow.labelClass}`}
                              >
                                {day.month}
                              </span>
                            ) : isToday ? (
                              <span
                                className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${matrixThemeStyles.headerRow.todayBadgeClass}`}
                              >
                                Today
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div
                    className="sticky top-[76px] z-20 grid"
                    style={{
                      gridTemplateColumns: matrixGridTemplate,
                      background: matrixThemeStyles.subHeader.background,
                      borderBottom: "1px solid rgba(148, 163, 184, 0.14)",
                      backdropFilter: "blur(12px)",
                    }}
                  >
                    <div
                      className="sticky left-0 z-30 px-5 py-5"
                      style={{
                        borderRight: "1px solid rgba(148, 163, 184, 0.16)",
                        background:
                          matrixThemeStyles.subHeader.stickyBackground,
                        boxShadow: "2px 0 10px rgba(15,23,42,0.06)",
                      }}
                    >
                      <p
                        className={`text-xs font-bold uppercase tracking-wider ${matrixThemeStyles.subHeader.subtextClass}`}
                      >
                        Hotel Summary
                      </p>
                      <p
                        className={`mt-1 text-sm font-bold ${matrixThemeStyles.subHeader.textClass}`}
                      >
                        {propertyName}
                      </p>
                      <p
                        className={`mt-1 text-xs ${matrixThemeStyles.subHeader.subtextClass}`}
                      >
                        Current live-room availability by date
                      </p>
                    </div>
                    {visibleInventorySummary.map((summary, index) => {
                      const isSelected = index === selectedDateIndex;
                      return (
                        <button
                          type="button"
                          key={summary.stay_date}
                          className="p-1"
                          onClick={(event) => {
                            const anchor = event.currentTarget;
                            const rect = anchor.getBoundingClientRect();
                            const popupWidth = 220;
                            const left = Math.max(
                              16,
                              Math.min(
                                rect.right + 10,
                                window.innerWidth - popupWidth - 16,
                              ),
                            );
                            const top = Math.max(
                              16,
                              Math.min(rect.top, window.innerHeight - 260),
                            );
                            setSummaryPopover((current) =>
                              current?.stayDate === summary.stay_date
                                ? null
                                : {
                                    anchorEl: anchor,
                                    stayDate: summary.stay_date,
                                    left,
                                    top,
                                    summary,
                                  },
                            );
                          }}
                          style={{
                            borderRight: "1px solid rgba(148, 163, 184, 0.10)",
                            backgroundColor: isSelected
                              ? isSoftLightTheme
                                ? "rgba(116,43,101,0.08)"
                                : isDarkTheme || isMidnightTheme
                                  ? "rgba(99,102,241,0.08)"
                                  : "rgba(15, 23, 42, 0.04)"
                              : "transparent",
                          }}
                        >
                          <div
                            className="flex flex-col items-center justify-center rounded-sm border py-2"
                            style={{
                              minHeight: "52px",
                              borderColor: matrixThemeStyles.card.borderColor,
                              background: matrixThemeStyles.card.background,
                            }}
                          >
                            <span className="material-symbols-outlined text-[14px] text-slate-400">
                              sell
                            </span>
                            <span
                              className={`mt-0.5 text-[13px] font-bold leading-none ${matrixThemeStyles.card.textClass}`}
                            >
                              {summary.total_active_rate}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {summaryPopover ? (
                    <div
                      className="fixed z-50 w-[220px] rounded-2xl border p-3 shadow-xl backdrop-blur"
                      style={{
                        left: `${summaryPopover.left}px`,
                        top: `${summaryPopover.top}px`,
                        borderColor: "var(--soft-border)",
                        background: matrixThemeStyles.card.popupBackground,
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-[0.16em] ${matrixThemeStyles.card.mutedClass}`}
                        >
                          {summaryPopover.stayDate}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSummaryPopover(null)}
                          className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                          <span className="material-symbols-outlined text-sm">
                            close
                          </span>
                        </button>
                      </div>
                      <div className="flex flex-col gap-2">
                        {[
                          [
                            "meeting_room",
                            "Active Rooms",
                            summaryPopover.summary.total_active_room,
                            "bg-emerald-50 text-emerald-700",
                            "text-emerald-800",
                          ],
                          [
                            "sell",
                            "Active Rates",
                            summaryPopover.summary.total_active_rate,
                            "bg-blue-50 text-blue-700",
                            "text-blue-800",
                          ],
                          [
                            "bed",
                            "Booked",
                            summaryPopover.summary.booked_room,
                            "bg-amber-50 text-amber-700",
                            "text-amber-800",
                          ],
                          [
                            "block",
                            "Unavailable",
                            summaryPopover.summary.unavailable_room,
                            "bg-rose-50 text-rose-700",
                            "text-rose-800",
                          ],
                          [
                            "inventory_2",
                            "Available",
                            summaryPopover.summary.available_room,
                            "bg-slate-100 text-slate-700",
                            "text-slate-900",
                          ],
                        ].map(
                          (
                            [icon, label, value, toneClass, valueClass],
                            metricIndex,
                          ) => (
                            <div
                              key={`${summaryPopover.stayDate}-${metricIndex}`}
                              className={`flex min-h-[42px] items-center justify-between rounded-xl px-3 py-2 ${toneClass}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">
                                  {icon}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
                                  {label}
                                </span>
                              </div>
                              <span
                                className={`text-[15px] font-bold leading-none ${valueClass}`}
                              >
                                {value}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  ) : null}

                  {cellPopover ? (
                    <div
                      className="fixed z-50 w-[240px] rounded-2xl border p-3 shadow-xl backdrop-blur"
                      style={{
                        left: `${cellPopover.left}px`,
                        top: `${cellPopover.top}px`,
                        borderColor: "var(--soft-border)",
                        background: matrixThemeStyles.card.popupBackground,
                      }}
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                            {cellPopover.stayDate}
                          </div>
                          <div
                            className={`mt-1 text-sm font-bold ${matrixThemeStyles.card.textClass}`}
                          >
                            {cellPopover.rowTitle}
                          </div>
                          {(() => {
                            const t = new Date();
                            t.setHours(0, 0, 0, 0);
                            return (
                              new Date(cellPopover.stayDate + "T00:00:00") < t
                            );
                          })() && (
                            <div className="mt-1 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Past — read only
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCellPopover(null)}
                          className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        >
                          <span className="material-symbols-outlined text-sm">
                            close
                          </span>
                        </button>
                      </div>
                      <div className="space-y-3">
                        <label className="block">
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                            Current Status
                          </span>
                          <select
                            value={getAvailabilitySelectValue(
                              cellPopover.cellAvailability,
                            )}
                            disabled={
                              !apiConnected ||
                              !cellPopover.stayDate ||
                              (() => {
                                const t = new Date();
                                t.setHours(0, 0, 0, 0);
                                return (
                                  new Date(cellPopover.stayDate + "T00:00:00") <
                                  t
                                );
                              })()
                            }
                            onChange={(event) => {
                              updateCell(
                                cellPopover.rateId,
                                cellPopover.stayDate,
                                {
                                  availability: normalizeAvailabilityInput(
                                    event.target.value,
                                  ),
                                },
                              );
                              setCellPopover((current) =>
                                current
                                  ? {
                                      ...current,
                                      cellAvailability: event.target.value,
                                      availabilityLabel:
                                        getAvailabilityDisplayLabel(
                                          event.target.value,
                                        ),
                                    }
                                  : current,
                              );
                              setPublishError("");
                              setPublishSuccess("");
                            }}
                            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none"
                            style={{
                              borderColor: "var(--soft-border)",
                              background:
                                "color-mix(in srgb, var(--panel-bg) 88%, transparent)",
                              color:
                                isDarkTheme || isMidnightTheme
                                  ? "#e2e8f0"
                                  : "#334155",
                            }}
                          >
                            {availabilityOptions.map((status) => (
                              <option
                                key={`popover-${cellPopover.rateId}-${status.value}`}
                                value={status.value}
                              >
                                {status.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                            Current Rate
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={cellPopover.cellRate}
                            disabled={
                              !apiConnected ||
                              !cellPopover.stayDate ||
                              (() => {
                                const t = new Date();
                                t.setHours(0, 0, 0, 0);
                                return (
                                  new Date(cellPopover.stayDate + "T00:00:00") <
                                  t
                                );
                              })()
                            }
                            onChange={(event) => {
                              updateCell(
                                cellPopover.rateId,
                                cellPopover.stayDate,
                                {
                                  base_rate: event.target.value,
                                },
                              );
                              setCellPopover((current) =>
                                current
                                  ? { ...current, cellRate: event.target.value }
                                  : current,
                              );
                              setPublishError("");
                              setPublishSuccess("");
                            }}
                            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none"
                            style={{
                              borderColor: "var(--soft-border)",
                              background:
                                "color-mix(in srgb, var(--panel-bg) 88%, transparent)",
                              color:
                                isDarkTheme || isMidnightTheme
                                  ? "#f8fafc"
                                  : "#0f172a",
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {!filteredAvailableRows.length ? (
                    <div className="px-5 py-10 text-center text-sm font-medium text-slate-500">
                      {rateMatrixSearch.trim()
                        ? "No rate plans matched that search."
                        : apiConnected
                          ? `No live-room rate plans found for ${selectedProperty || "this property"}.`
                          : "Backend offline. Start the API to load editable daily rates."}
                    </div>
                  ) : null}

                  {filteredAvailableRows.map((row, rowIndex) => (
                    <div
                      key={row.code}
                      className="grid transition-colors"
                      style={{
                        gridTemplateColumns: matrixGridTemplate,
                      }}
                    >
                      <div
                        className="sticky left-0 z-20 flex flex-col justify-center px-4 py-3 shadow-[2px_0_10px_rgba(15,23,42,0.06)] transition-colors dark:shadow-[2px_0_10px_rgba(0,0,0,0.20)]"
                        style={{
                          minHeight: "54px",
                          borderRight: "1px solid rgba(148,163,184,0.16)",
                          borderBottom: "1px solid rgba(148, 163, 184, 0.10)",
                          background:
                            rowIndex % 2 === 0
                              ? matrixThemeStyles.firstColumn.evenBg
                              : matrixThemeStyles.firstColumn.oddBg,
                          backdropFilter: "blur(16px) saturate(140%)",
                          WebkitBackdropFilter: "blur(16px) saturate(140%)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`min-w-0 flex-1 font-headline text-[15px] font-semibold leading-tight ${matrixThemeStyles.firstColumn.titleClass}`}
                            title={row.title}
                          >
                            {String(row.title).slice(0, 18)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRatePlan(row)}
                            disabled={
                              !apiConnected ||
                              publishing ||
                              deletingRateId === row.code
                            }
                            title={
                              deletingRateId === row.code
                                ? "Removing..."
                                : "Remove"
                            }
                            aria-label={
                              deletingRateId === row.code
                                ? "Removing..."
                                : "Remove"
                            }
                            className="inline-flex size-6 shrink-0 items-center justify-center rounded border border-rose-200 bg-rose-50 text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800/40 dark:bg-rose-950/30 dark:text-rose-400"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              delete
                            </span>
                          </button>
                        </div>
                      </div>

                      {row.cells
                        .slice(0, totalDays)
                        .map((cell, index) =>
                          renderInventoryStyleRateCell(row, cell, index),
                        )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          {showRatePlanModal ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 pt-20 backdrop-blur-sm">
              <div
                className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
                style={{ background: "var(--popup-card-bg)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                      Rate Plan
                    </p>
                    <h3 className="mt-2 text-2xl font-bold text-slate-900">
                      {ratePlanModalMode === "edit"
                        ? "Edit Rate Plan for"
                        : "Add Rate Plan for"}{" "}
                      {selectedRoomForRatePlan?.room_name ||
                        selectedRoomForRatePlan?.room_id}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {ratePlanModalMode === "edit"
                        ? "Update the full rate plan details directly from the daily-rates workspace."
                        : "Create a new rate plan directly from the daily-rates workspace."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeRatePlanModal}
                    className="rounded-full border border-slate-200 p-2 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <form
                  onSubmit={handleSubmitRatePlan}
                  className="mt-6 space-y-4"
                >
                  {/* <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Room ID
                      </span>
                      <input
                        value={newRatePlanForm.room_id}
                        readOnly
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Rate ID
                      </span>
                      <input
                        value={
                          newRatePlanForm.rate_id ||
                          (ratePlanModalMode === "edit"
                            ? editingRatePlanId
                            : "Auto-generated")
                        }
                        readOnly
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                      />
                    </label>
                  </div> */}
                  {loadingRatePlanDetails ? (
                    <p
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600"
                      style={softLightGlassInsetStyle}
                    >
                      Loading full rate plan details...
                    </p>
                  ) : null}
                  <div
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/60"
                    style={softLightGlassCardStyle}
                  >
                    {(() => {
                      const roomSummary = getRoomSummarySource(
                        selectedRoomSummary,
                        selectedRoomForRatePlan,
                      );
                      const cur = newRatePlanForm.currency || "USD";
                      const rows = [
                        ["Base Rate", roomSummary?.base_rate || 0],
                        [
                          "Tax & Service",
                          roomSummary?.tax_and_service_fee || 0,
                        ],
                        ["Surcharges", roomSummary?.surcharges || 0],
                        ["Mandatory Fee", roomSummary?.mandatory_fee || 0],
                        ["Resort Fee", roomSummary?.resort_fee || 0],
                        ["Mandatory Tax", roomSummary?.mandatory_tax || 0],
                      ];
                      const total = rows.reduce((s, [, v]) => s + Number(v), 0);
                      return (
                        <>
                          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                            Room Summary
                          </h2>
                          <h4 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                            {roomSummary?.room_name ||
                              roomSummary?.room_id ||
                              "Selected Room"}
                          </h4>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {[
                              roomSummary?.room_id,
                              roomSummary?.room_name_lang,
                              roomSummary?.room_status,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </p>
                          {loadingRoomSummary ? (
                            <p className="mt-2 text-[11px] text-slate-400">
                              Loading room data...
                            </p>
                          ) : null}
                          <div className="mt-3 space-y-1.5">
                            {rows.map(([label, value]) => (
                              <div
                                key={label}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="text-slate-500 dark:text-slate-400">
                                  {label}
                                </span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {formatMoneyWithCurrency(cur, value)}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              Total Room Amount
                            </h3>
                            <span className="text-base font-black text-slate-900 dark:text-slate-100">
                              {formatMoneyWithCurrency(cur, total)}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                    style={softLightGlassCardStyle}
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                      Rate Details
                    </p>
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-4 md:grid-cols-1">
                        <label className="block">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Title
                          </span>
                          <input
                            value={newRatePlanForm.title}
                            onChange={(event) =>
                              setNewRatePlanForm((current) => ({
                                ...current,
                                title: event.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                          />
                        </label>
                      </div>
                      <label className="block">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Description
                        </span>
                        <textarea
                          value={newRatePlanForm.description}
                          onChange={(event) =>
                            setNewRatePlanForm((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          rows={3}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                        />
                      </label>
                      <div className="grid gap-4 md:grid-cols-4">
                        <label className="block">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Meal Plan
                          </span>
                          <select
                            value={newRatePlanForm.meal_plan}
                            onChange={(event) =>
                              setNewRatePlanForm((current) => ({
                                ...current,
                                meal_plan: event.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                          >
                            <option value="">Select meal plan</option>
                            {mealPlanOptions.map((mealPlan) => (
                              <option
                                key={mealPlan.value}
                                value={mealPlan.value}
                              >
                                {mealPlan.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Bed Type
                          </span>
                          <select
                            value={newRatePlanForm.bed_type}
                            onChange={(event) =>
                              setNewRatePlanForm((current) => ({
                                ...current,
                                bed_type: event.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                          >
                            <option value="">Select bed type</option>
                            {bedTypeOptions.map((bedType) => (
                              <option key={bedType.value} value={bedType.value}>
                                {bedType.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {[
                          ["currency", "Currency"],
                          ["cancellation_policy", "Cancellation"],
                        ].map(([field, label]) => (
                          <label key={field} className="block">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              {label}
                            </span>
                            <input
                              value={newRatePlanForm[field]}
                              onChange={(event) =>
                                setNewRatePlanForm((current) => ({
                                  ...current,
                                  [field]: event.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="grid gap-4 md:grid-cols-4">
                        {[
                          ["base_rate", "Base Rate"],
                          ["tax_and_service_fee", "Tax & Service"],
                          ["surcharges", "Surcharges"],
                          ["mandatory_fee", "Mandatory Fee"],
                          ["resort_fee", "Resort Fee"],
                          ["mandatory_tax", "Mandatory Tax"],
                          ["extra_adult_rate", "Extra Adult"],
                          ["extra_child_rate", "Extra Child"],
                        ].map(([field, label]) => (
                          <label key={field} className="block">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              {label}
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={newRatePlanForm[field]}
                              onChange={(event) =>
                                setNewRatePlanForm((current) => ({
                                  ...current,
                                  [field]: event.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="grid gap-4 md:grid-cols-4">
                        {[
                          ["min_stay", "Min Stay"],
                          ["max_stay", "Max Stay"],
                          ["total_inventory", "Total Inventory"],
                          ["available_inventory", "Available"],
                          ["sold_inventory", "Sold"],
                        ].map(([field, label]) => (
                          <label key={field} className="block">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              {label}
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={newRatePlanForm[field]}
                              onChange={(event) =>
                                setNewRatePlanForm((current) => ({
                                  ...current,
                                  [field]: event.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="grid gap-3 md:grid-cols-5">
                        {[
                          ["is_refundable", "Refund able"],
                          ["status", "Active"],
                          ["closed_to_arrival", "CTA"],
                          ["closed_to_departure", "CTD"],
                          ["stop_sell", "Stop Sell"],
                        ].map(([field, label]) => (
                          <label
                            key={field}
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(newRatePlanForm[field])}
                              onChange={(event) =>
                                setNewRatePlanForm((current) => ({
                                  ...current,
                                  [field]: event.target.checked,
                                }))
                              }
                              className="size-4 rounded border-slate-300"
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
                    {ratePlanModalError ? (
                      <p className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                        {ratePlanModalError}
                      </p>
                    ) : null}
                    {ratePlanModalSuccess ? (
                      <p className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                        {ratePlanModalSuccess}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                          Preview
                        </p>
                        <h4 className="mt-2 text-lg font-bold text-slate-900">
                          {String(newRatePlanForm.title || "Untitled Rate Plan")
                            .match(/.{1,20}/g)
                            ?.map((chunk, index) => (
                              <span key={`${chunk}-${index}`}>
                                {chunk}
                                <br />
                              </span>
                            ))}
                        </h4>
                        <p className="mt-1 text-sm text-slate-500">
                          {[
                            newRatePlanForm.room_id ||
                              selectedRoomForRatePlan?.room_id,
                            newRatePlanForm.meal_plan || "Meal plan pending",
                            newRatePlanForm.bed_type || "Bed type pending",
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      </div>
                      <div
                        className="w-full rounded-2xl bg-white px-4 py-3 text-right shadow-sm md:max-w-sm"
                        style={softLightGlassInsetStyle}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                          Subtotal Price
                        </p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">
                          {formatMoneyWithCurrency(
                            newRatePlanForm.currency,
                            ratePlanPreview.subtotal,
                          )}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Base + tax/service + surcharges + mandatory fees
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div
                        className="rounded-2xl bg-white p-4 shadow-sm"
                        style={softLightGlassInsetStyle}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                          Price Breakdown
                        </p>
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <div className="flex items-center justify-between">
                            <span>Base rate</span>
                            <span className="font-bold text-slate-900">
                              {formatMoneyWithCurrency(
                                newRatePlanForm.currency,
                                ratePlanPreview.baseRate,
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Tax & service</span>
                            <span className="font-bold text-slate-900">
                              {formatMoneyWithCurrency(
                                newRatePlanForm.currency,
                                ratePlanPreview.taxAndServiceFee,
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Surcharges</span>
                            <span className="font-bold text-slate-900">
                              {formatMoneyWithCurrency(
                                newRatePlanForm.currency,
                                ratePlanPreview.surcharges,
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Mandatory fee</span>
                            <span className="font-bold text-slate-900">
                              {formatMoneyWithCurrency(
                                newRatePlanForm.currency,
                                ratePlanPreview.mandatoryFee,
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Resort fee</span>
                            <span className="font-bold text-slate-900">
                              {formatMoneyWithCurrency(
                                newRatePlanForm.currency,
                                ratePlanPreview.resortFee,
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Mandatory tax</span>
                            <span className="font-bold text-slate-900">
                              {formatMoneyWithCurrency(
                                newRatePlanForm.currency,
                                ratePlanPreview.mandatoryTax,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        className="rounded-2xl bg-white p-4 shadow-sm"
                        style={softLightGlassInsetStyle}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                          Flags & Policy
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[
                            newRatePlanForm.status ? "Active" : "Inactive",
                            newRatePlanForm.is_refundable
                              ? "Refundable"
                              : "Non-refundable",
                            newRatePlanForm.closed_to_arrival ? "CTA" : null,
                            newRatePlanForm.closed_to_departure ? "CTD" : null,
                            newRatePlanForm.stop_sell ? "Stop Sell" : null,
                          ]
                            .filter(Boolean)
                            .map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700"
                              >
                                {tag}
                              </span>
                            ))}
                        </div>
                        <div className="mt-4 space-y-2 text-sm text-slate-600">
                          <p>
                            Cancellation:{" "}
                            <span className="font-bold text-slate-900">
                              {newRatePlanForm.cancellation_policy || "Not set"}
                            </span>
                          </p>
                          <p>
                            Extra adult:{" "}
                            <span className="font-bold text-slate-900">
                              {formatMoneyWithCurrency(
                                newRatePlanForm.currency,
                                newRatePlanForm.extra_adult_rate,
                              )}
                            </span>
                          </p>
                          <p>
                            Extra child:{" "}
                            <span className="font-bold text-slate-900">
                              {formatMoneyWithCurrency(
                                newRatePlanForm.currency,
                                newRatePlanForm.extra_child_rate,
                              )}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={closeRatePlanModal}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingNewRatePlan || loadingRatePlanDetails}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingNewRatePlan
                          ? "Saving..."
                          : ratePlanModalMode === "edit"
                            ? "Save Rate Plan"
                            : "Create Rate Plan"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
          {activeRoomPlansModal ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
              <div
                className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
                style={{ background: "var(--popup-card-bg)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                      Rate Plan List
                    </p>
                    <h3 className="mt-2 text-2xl font-bold text-slate-900">
                      {activeRoomPlansModal.room_name} ·{" "}
                      {activeRoomPlansModal.room_id}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      All linked rate plans for this live room.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeActiveRoomPlansModal}
                    className="rounded-full border border-slate-200 p-2 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  {(activeRoomPlansModal.linked_rate_plans || []).map(
                    (plan) => (
                      <button
                        type="button"
                        key={plan.code}
                        onClick={() =>
                          openEditRatePlanModal(activeRoomPlansModal, plan)
                        }
                        className="block w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-slate-300 hover:bg-white"
                        style={softLightGlassCardStyle}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="text-base font-bold text-slate-900">
                              {plan.title}
                            </h4>
                            <p className="mt-1 text-xs text-slate-500">
                              {[plan.code, plan.roomLabel, plan.strategy]
                                .filter(Boolean)
                                .join(" • ")}
                            </p>
                          </div>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                            {plan.stopSell ? "Stopped" : "Active"}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div
                            className="rounded-xl bg-white px-3 py-3"
                            style={softLightGlassInsetStyle}
                          >
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Rate ID
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-900">
                              {plan.code}
                            </p>
                          </div>
                          <div
                            className="rounded-xl bg-white px-3 py-3"
                            style={softLightGlassInsetStyle}
                          >
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Base Rate
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-900">
                              {plan.cells?.[0]?.currency || "USD"}{" "}
                              {plan.cells?.[0]?.base_rate || "0.00"}
                            </p>
                          </div>
                          {/* <div className="rounded-xl bg-white px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Occupancy</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{plan.occupancy}</p>
                    </div> */}
                          <div
                            className="rounded-xl bg-white px-3 py-3"
                            style={softLightGlassInsetStyle}
                          >
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Flags
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-900">
                              {[
                                plan.stopSell && "Stop Sell",
                                plan.cta && "CTA",
                                plan.ctd && "CTD",
                              ]
                                .filter(Boolean)
                                .join(", ") || "None"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs font-semibold text-slate-500">
                          <span>Click this rate plan to edit all fields.</span>
                          <span className="inline-flex items-center gap-1 text-slate-900">
                            <span className="material-symbols-outlined text-sm">
                              edit_square
                            </span>
                            Edit full plan
                          </span>
                        </div>
                      </button>
                    ),
                  )}

                  {!activeRoomPlansModal.linked_rate_plans?.length ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                      No rate plans linked to this room yet.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Floating publish button — fixed below navbar, animates in when there are pending changes */}
      <div
        className="pointer-events-none fixed right-6 z-[90] transition-all duration-500 ease-out"
        style={{ top: "85px" }}
      >
        <div
          className={[
            "pointer-events-auto flex flex-col items-end gap-2 transition-all duration-500",
            pendingChanges > 0
              ? "translate-y-0 opacity-100"
              : "-translate-y-4 opacity-0",
          ].join(" ")}
        >
          {/* pulse ring */}
          {pendingChanges > 0 && !publishing && (
            <span className="absolute -inset-1 animate-ping rounded-2xl bg-primary/30" />
          )}
          <button
            type="button"
            onClick={publishChanges}
            disabled={publishing || !pendingChanges}
            className="relative flex items-center gap-2.5 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-2xl shadow-primary/40 transition-all hover:scale-105 hover:shadow-primary/60 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              className={[
                "material-symbols-outlined text-lg",
                publishing ? "animate-spin" : "",
              ].join(" ")}
            >
              {publishing ? "progress_activity" : "publish"}
            </span>
            <span>{publishing ? "Publishing..." : `Publish Changes`}</span>
            {pendingChanges > 0 && !publishing && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-black text-primary">
                {pendingChanges}
              </span>
            )}
          </button>
          {publishError && (
            <div className="max-w-[260px] rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 shadow-lg dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300">
              {publishError}
            </div>
          )}
          {publishSuccess && (
            <div className="max-w-[260px] rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 shadow-lg dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
              {publishSuccess}
            </div>
          )}
        </div>
      </div>
    </PmsShell>
  );
}
