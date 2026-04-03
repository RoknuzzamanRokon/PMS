"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PmsShell } from "./pms-shell";
import { fetchJson } from "../lib/api";

const totalDays = 30;
const visibleMatrixDays = 7;
const unavailableStatuses = ["UNAVAILABLE", "BOOKED", "PROSSING", "AB-UNAVAILABLE", "CTA", "CTD", "STOP_SELL", "OUT_OF_ORDER", "OUT_OF_SERVICE", "OVERBOOKED"];

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
  const start = startDate ? new Date(startDate) : new Date();

  return Array.from({ length: total }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      isoDate: toIsoDateFromParts(date.getFullYear(), date.getMonth(), date.getDate()),
      shortDay: date.toLocaleDateString("en-US", { weekday: "short" }),
      dayNum: String(date.getDate()).padStart(2, "0"),
      month: date.toLocaleDateString("en-US", { month: "short" }),
    };
  });
}

function getTone(item, index) {
  if (["UNAVAILABLE", "STOP_SELL", "OUT_OF_ORDER", "OUT_OF_SERVICE", "OVERBOOKED", "AB-UNAVAILABLE"].includes(item.availability)) {
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
  return !value || unavailableStatuses.includes(String(value || "").toUpperCase());
}

function getAvailabilityDisplayLabel(value) {
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

function parseRateValue(value) {
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatRateValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "0.00";
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

function createRatePlanForm(room) {
  return {
    rate_id: "",
    room_id: room?.room_id || "",
    title: room?.room_name ? `${room.room_name} Flexible` : "",
    description: "Best flexible rate",
    meal_plan: "BB",
    is_refundable: true,
    bed_type: "King",
    cancellation_policy: "24h flexible",
    status: true,
    min_stay: "1",
    max_stay: "30",
    currency: "USD",
    base_rate: formatRateValue(room?.base_rate ?? 0),
    tax_and_service_fee: formatRateValue(room?.tax_and_service_fee ?? 0),
    surcharges: "5.00",
    mandatory_fee: "3.00",
    resort_fee: "2.00",
    mandatory_tax: "7.00",
    total_inventory: "12",
    available_inventory: "4",
    sold_inventory: "8",
    closed_to_arrival: false,
    closed_to_departure: false,
    stop_sell: false,
    extra_adult_rate: "25.00",
    extra_child_rate: "15.00",
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
    min_stay: parseIntegerValue(form.min_stay),
    max_stay: parseIntegerValue(form.max_stay),
    currency: form.currency.trim(),
    base_rate: Number(form.base_rate),
    tax_and_service_fee: Number(form.tax_and_service_fee),
    surcharges: Number(form.surcharges),
    mandatory_fee: Number(form.mandatory_fee),
    resort_fee: Number(form.resort_fee),
    mandatory_tax: Number(form.mandatory_tax),
    total_inventory: parseIntegerValue(form.total_inventory),
    available_inventory: parseIntegerValue(form.available_inventory),
    sold_inventory: parseIntegerValue(form.sold_inventory),
    closed_to_arrival: Boolean(form.closed_to_arrival),
    closed_to_departure: Boolean(form.closed_to_departure),
    stop_sell: Boolean(form.stop_sell),
    extra_adult_rate: Number(form.extra_adult_rate),
    extra_child_rate: Number(form.extra_child_rate),
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

function buildRowsFromApi(rooms, ratePlans, calendarByRateId, startDate, total, inventoryRows = []) {
  if (!ratePlans.length) {
    return [];
  }

  const roomMap = new Map(rooms.map((room) => [room.room_id, room]));
  const bookingByRoomId = new Map((inventoryRows || []).map((row) => [row.room_id, row.booking || null]));
  const start = startDate ? new Date(startDate) : new Date();

  return ratePlans.map((ratePlan) => {
    const room = roomMap.get(ratePlan.room_id);
    const booking = bookingByRoomId.get(ratePlan.room_id);
    const calendar = calendarByRateId[ratePlan.rate_id] || [];
    const calendarMap = new Map(calendar.map((item) => [item.stay_date, item]));
    const occupancyPercent = ratePlan.total_inventory
      ? Math.round((ratePlan.sold_inventory / ratePlan.total_inventory) * 100)
      : 0;
    const cells = Array.from({ length: total }, (_, index) => {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + index);
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
      const fallbackBookingStatus = String(booking?.booking_status || "").toUpperCase();
      const availability = item?.availability || (fallbackBooked
        ? ["CONFIRMED", "CHECKED_IN"].includes(fallbackBookingStatus)
          ? "BOOKED"
          : "PROSSING"
        : "");
      const baseRate = formatRateValue(item?.base_rate ?? ratePlan.base_rate ?? 0);
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
      roomLabel: room?.room_name ? `${room.room_name} • ${room.room_id}` : room?.room_id || ratePlan.room_id,
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

function buildHotelSummaryFallback(rooms, ratePlans, startDate, total, inventoryRows = []) {
  const liveRooms = (rooms || []).filter((room) => String(room.room_status || "").toUpperCase() === "LIVE");
  const liveRoomIds = new Set(liveRooms.map((room) => room.room_id));
  const rowsByRoomId = new Map((inventoryRows || []).map((row) => [row.room_id, row]));
  const days = createDays(startDate, total);

  return days.map((day) => {
    const bookedRoomIds = new Set();

    for (const room of liveRooms) {
      const booking = rowsByRoomId.get(room.room_id)?.booking;
      if (!booking?.check_in_date || !booking?.check_out_date) {
        continue;
      }
      if (day.isoDate >= booking.check_in_date && day.isoDate < booking.check_out_date) {
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
        if (ratePlan.stop_sell || ratePlan.closed_to_arrival || ratePlan.closed_to_departure) {
          return false;
        }
        const calendarItem = (ratePlan.calendar || []).find((item) => item.stay_date === day.isoDate);
        return calendarItem && !isUnavailableAvailability(calendarItem.availability);
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
  const availability = Array.isArray(payload?.availability) ? payload.availability : [];

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
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{stat.note}</p>
    </article>
  );
}

export function DailyRatesPage({ propertyId }) {
  const router = useRouter();
  const matrixScrollRef = useRef(null);
  const matrixDragRef = useRef({
    active: false,
    startX: 0,
    scrollLeft: 0,
  });
  const hasSelectedProperty = Boolean(propertyId);
  const liveRoomStatus = "LIVE";
  const [range, setRange] = useState(7);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(propertyId || "");
  const [rows, setRows] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [propertyName, setPropertyName] = useState("Selected Property");
  const [calendarStartDate, setCalendarStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [apiConnected, setApiConnected] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishSuccess, setPublishSuccess] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [deletingRateId, setDeletingRateId] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [summaryPopover, setSummaryPopover] = useState(null);
  const [availabilityStatuses, setAvailabilityStatuses] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [showRatePlanModal, setShowRatePlanModal] = useState(false);
  const [selectedRoomForRatePlan, setSelectedRoomForRatePlan] = useState(null);
  const [ratePlanModalMode, setRatePlanModalMode] = useState("create");
  const [editingRatePlanId, setEditingRatePlanId] = useState("");
  const [ratePlanModalError, setRatePlanModalError] = useState("");
  const [ratePlanModalSuccess, setRatePlanModalSuccess] = useState("");
  const [savingNewRatePlan, setSavingNewRatePlan] = useState(false);
  const [loadingRatePlanDetails, setLoadingRatePlanDetails] = useState(false);
  const [roomListMessage, setRoomListMessage] = useState("");
  const [activeRoomPlansModal, setActiveRoomPlansModal] = useState(null);
  const matrixRoomColumnWidth = 280;
  const matrixDayColumnWidth = 120;
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
  const [newRatePlanForm, setNewRatePlanForm] = useState(createRatePlanForm(null));
  const days = useMemo(() => createDays(calendarStartDate, totalDays), [calendarStartDate]);
  const visibleDays = useMemo(() => days.slice(0, range), [days, range]);

  useEffect(() => {
    setSummaryPopover(null);
  }, [selectedProperty, calendarStartDate, range]);
  const ratePlanPreview = useMemo(() => {
    const baseRate = parseRateValue(newRatePlanForm.base_rate);
    const taxAndServiceFee = parseRateValue(newRatePlanForm.tax_and_service_fee);
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
      availableInventory: parseIntegerValue(newRatePlanForm.available_inventory),
      soldInventory: parseIntegerValue(newRatePlanForm.sold_inventory),
      minStay: parseIntegerValue(newRatePlanForm.min_stay),
      maxStay: parseIntegerValue(newRatePlanForm.max_stay),
    };
  }, [newRatePlanForm]);

  useEffect(() => {
    setSelectedProperty(propertyId || "");
  }, [propertyId]);

  useEffect(() => {
    setSelectedDateIndex((current) => Math.min(current, Math.max(range - 1, 0)));
  }, [range, calendarStartDate]);

  useEffect(() => {
    let ignore = false;

    async function loadRates() {
      setLoadingRates(true);
      try {
        const [propertyList, statusList, mealPlanList] = await Promise.all([
          fetchJson("/properties"),
          fetchJson("/rate-plans/availability-statuses").catch(() => []),
          fetchJson("/meal-plans").catch(() => []),
        ]);
        if (ignore) {
          return;
        }

        setProperties(propertyList);
        setAvailabilityStatuses(Array.isArray(statusList) ? statusList : []);
        setMealPlans(Array.isArray(mealPlanList) ? mealPlanList : []);

        if (!propertyId) {
          if (!ignore) {
            setSelectedProperty("");
            setRows([]);
            setRooms([]);
            setInventoryDates([]);
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

        const inventoryEndDate = days[Math.max(range - 1, 0)]?.isoDate || calendarStartDate;
        const [data, inventoryData, inventoryBoardData, availableDatesData] = await Promise.all([
          fetchJson(
            `/rate-plans/daily-rates?property_id=${encodeURIComponent(resolvedPropertyId)}&days=${totalDays}&start_date=${calendarStartDate}`,
          ),
          fetchJson(
            `/properties/${encodeURIComponent(resolvedPropertyId)}/inventory-calendar?start_date=${calendarStartDate}&end_date=${inventoryEndDate}`,
          ).catch(() => ({ dates: [] })),
          fetchJson(
            `/inventory/calendar?property_id=${encodeURIComponent(resolvedPropertyId)}&start_date=${calendarStartDate}&days=${range}`,
          ).catch(() => ({ rows: [] })),
          fetchJson(
            `/search/available-dates?property_id=${encodeURIComponent(resolvedPropertyId)}&start_date=${calendarStartDate}&days=${range}`,
          ).catch(() => ({ property: null, availability: [] })),
        ]);

        if (ignore) {
          return;
        }

        const calendarByRateId = Object.fromEntries(
          (data.rate_plans || []).map((ratePlan) => [ratePlan.rate_id, ratePlan.calendar || []]),
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
        const nextInventoryDates = Array.isArray(inventoryData?.dates) && inventoryData.dates.length
          ? inventoryData.dates
          : buildHotelSummaryFallback(
              data.rooms || [],
              data.rate_plans || [],
              calendarStartDate,
              range,
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
  }, [propertyId, calendarStartDate, range]);

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

  const pendingChanges = useMemo(
    () => rows.reduce((count, row) => count + row.cells.filter((cell) => cell.changed).length, 0),
    [rows],
  );
  const liveRoomIds = useMemo(
    () =>
      new Set(
        rooms
          .filter((room) => String(room.room_status || "").toUpperCase() === liveRoomStatus)
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
      .filter((room) => String(room.room_status || "").toUpperCase() === liveRoomStatus)
      .map((room) => {
        const linkedRatePlans = rows.filter((row) => row.roomId === room.room_id);
        return {
          ...room,
          linked_rate_plan_count: linkedRatePlans.length,
          active_rate_plan_count: linkedRatePlans.filter((row) => !row.stopSell).length,
          preview_rate_plan: linkedRatePlans[0] || null,
          linked_rate_plans: linkedRatePlans,
        };
      });
  }, [rooms, rows, liveRoomStatus]);
  const selectedDay = visibleDays[selectedDateIndex] || visibleDays[0] || null;
  const selectedStayDate = selectedDay?.isoDate || "";
  const selectedDateSummary = useMemo(() => {
    if (!selectedStayDate) {
      return { queued: 0, booked: 0, blocked: 0 };
    }

    return filteredAvailableRows.reduce(
      (summary, row) => {
        const cell = row.cells.find((item) => item.stay_date === selectedStayDate);
        if (!cell) {
          return summary;
        }

        if (cell.changed) {
          summary.queued += 1;
        }
        if (["BOOKED", "PROSSING", "CTA", "CTD"].includes(cell.availability)) {
          summary.booked += 1;
        }
        if (["UNAVAILABLE", "STOP_SELL", "OUT_OF_ORDER", "OUT_OF_SERVICE", "OVERBOOKED", "AB-UNAVAILABLE"].includes(cell.availability)) {
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

    const start = new Date(calendarStartDate);
    const next = new Date(value);
    const diff = Math.floor((next.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (diff >= 0 && diff < range) {
      setSelectedDateIndex(diff);
      return;
    }

    setCalendarStartDate(value);
    setSelectedDateIndex(0);
  }

  async function refreshDailyRates(propertyIdOverride) {
    const resolvedPropertyId = propertyIdOverride || selectedProperty || propertyId || "";
    if (!resolvedPropertyId) {
      setRows([]);
      setRooms([]);
      setInventoryDates([]);
      setPropertyName("Selected Property");
      setApiConnected(false);
      return;
    }

    const inventoryEndDate = days[Math.max(range - 1, 0)]?.isoDate || calendarStartDate;
    const [data, inventoryData, inventoryBoardData, availableDatesData] = await Promise.all([
      fetchJson(
        `/rate-plans/daily-rates?property_id=${encodeURIComponent(resolvedPropertyId)}&days=${totalDays}&start_date=${calendarStartDate}`,
      ),
      fetchJson(
        `/properties/${encodeURIComponent(resolvedPropertyId)}/inventory-calendar?start_date=${calendarStartDate}&end_date=${inventoryEndDate}`,
      ).catch(() => ({ dates: [] })),
      fetchJson(
        `/inventory/calendar?property_id=${encodeURIComponent(resolvedPropertyId)}&start_date=${calendarStartDate}&days=${range}`,
      ).catch(() => ({ rows: [] })),
      fetchJson(
        `/search/available-dates?property_id=${encodeURIComponent(resolvedPropertyId)}&start_date=${calendarStartDate}&days=${range}`,
      ).catch(() => ({ property: null, availability: [] })),
    ]);
    const calendarByRateId = Object.fromEntries(
      (data.rate_plans || []).map((ratePlan) => [ratePlan.rate_id, ratePlan.calendar || []]),
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
    const nextInventoryDates = Array.isArray(inventoryData?.dates) && inventoryData.dates.length
      ? inventoryData.dates
      : buildHotelSummaryFallback(
          data.rooms || [],
          data.rate_plans || [],
          calendarStartDate,
          range,
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
    const styles = toneClasses[cell.tone] || toneClasses.default;
    const cellRate = cell.base_rate ?? formatRateValue(parseRateValue(cell.value));
    const cellAvailability = cell.availability || "";
    const cellSelectValue = getAvailabilitySelectValue(cellAvailability);
    const availabilityLabel = getAvailabilityDisplayLabel(cellAvailability);
    const availabilityUi = getAvailabilityUiClasses(cellAvailability);

    return (
      <div
        key={`${row.code}-inventory-${index}`}
        className="px-2 py-2"
        style={{
          borderRight: "1px solid rgba(148, 163, 184, 0.12)",
          background:
            index === selectedDateIndex
              ? "rgba(15, 23, 42, 0.04)"
              : index % 2 === 0
                ? "rgba(255, 255, 255, 0.82)"
                : "rgba(248, 250, 252, 0.78)",
        }}
      >
        <div
          className={`${styles.box} ${availabilityUi.box} min-h-[126px] transition-colors`}
          style={{
            borderRadius: "12px",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.24)",
          }}
        >
          <span
            className={[
              styles.note,
              cell.note === "Booked" && "inline-flex rounded px-1.5 py-0.5 text-slate-900",
              cell.note === "Alt booked" && "inline-flex rounded px-1.5 py-0.5 text-slate-900",
              cell.note === "Processing" && "inline-flex rounded px-1.5 py-0.5 text-slate-900",
            ]
              .filter(Boolean)
              .join(" ")}
            style={
              cell.note === "Booked"
                ? { backgroundColor: "#4df714" }
                : cell.note === "Alt booked"
                  ? { backgroundColor: "#bb8df7" }
                  : cell.note === "Processing"
                    ? { backgroundColor: "#f2eb16" }
                    : undefined
            }
          >
            {cell.note}
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            className={styles.input}
            value={cellRate}
            disabled={!apiConnected || !cell.stay_date}
            onChange={(event) => {
              updateCell(row.code, cell.stay_date, { base_rate: event.target.value });
              setPublishError("");
              setPublishSuccess("");
            }}
          />
          <div
            className={[
              "mt-2 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
              availabilityUi.badge,
            ].join(" ")}
          >
            {availabilityLabel}
          </div>
          <select
            value={cellSelectValue}
            disabled={!apiConnected || !cell.stay_date}
            onChange={(event) => {
              updateCell(row.code, cell.stay_date, { availability: normalizeAvailabilityInput(event.target.value) });
              setPublishError("");
              setPublishSuccess("");
            }}
            className={[
              "mt-2 w-full rounded-md border bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider outline-none",
              availabilityUi.select,
            ].join(" ")}
          >
            {availabilityOptions.map((status) => (
              <option key={`${row.code}-${cell.stay_date}-${status.value}`} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] font-medium text-slate-400">
            <span>{cell.stay_date || "Demo"}</span>
            <span>{cell.changed ? "Queued" : apiConnected ? "Saved" : "Preview"}</span>
          </div>
        </div>
      </div>
    );
  }

  function openRatePlanModal(room) {
    if (String(room?.room_status || "").toUpperCase() !== liveRoomStatus) {
      setRoomListMessage("Rate plans can be created only for live rooms.");
      return;
    }
    setSelectedRoomForRatePlan(room);
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
    setRatePlanModalMode("create");
    setEditingRatePlanId("");
    setRatePlanModalError("");
    setRatePlanModalSuccess("");
    setLoadingRatePlanDetails(false);
    setNewRatePlanForm(createRatePlanForm(null));

    if (roomPlansContext) {
      setActiveRoomPlansModal(roomPlansContext);
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
    setRatePlanModalMode("edit");
    setEditingRatePlanId(plan.code);
    setRatePlanModalError("");
    setRatePlanModalSuccess("");
    setLoadingRatePlanDetails(true);
    setShowRatePlanModal(true);
    closeActiveRoomPlansModal();

    try {
      const ratePlan = await fetchJson(`/rate-plans/${encodeURIComponent(plan.code)}`);
      setNewRatePlanForm(createRatePlanFormFromDetails(room, ratePlan));
    } catch (error) {
      setRatePlanModalError(error.message || `Could not load rate plan ${plan.code}.`);
    } finally {
      setLoadingRatePlanDetails(false);
    }
  }

  async function handleSubmitRatePlan(event) {
    event.preventDefault();

    if (!newRatePlanForm.room_id) {
      setRatePlanModalError("Select a room first.");
      return;
    }

    if (String(selectedRoomForRatePlan?.room_status || "").toUpperCase() !== liveRoomStatus) {
      setRatePlanModalError("Rate plans can be created only for live rooms.");
      return;
    }

    setSavingNewRatePlan(true);
    setRatePlanModalError("");
    setRatePlanModalSuccess("");

    try {
      const isEditMode = ratePlanModalMode === "edit" && editingRatePlanId;
      await fetchJson(isEditMode ? `/rate-plans/${encodeURIComponent(editingRatePlanId)}` : "/rate-plans", {
        method: isEditMode ? "PATCH" : "POST",
        body: JSON.stringify(createRatePlanPayload(newRatePlanForm)),
      });

      await refreshDailyRates(newRatePlanForm.room_id ? selectedProperty : undefined);
      setRoomListMessage(
        isEditMode
          ? `Updated rate plan ${editingRatePlanId}.`
          : `Added a new rate plan for ${newRatePlanForm.room_id}.`,
      );
      closeRatePlanModal();
    } catch (error) {
      setRatePlanModalError(
        error.message || (ratePlanModalMode === "edit" ? "Could not update the rate plan." : "Could not create the rate plan."),
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
      setPublishError(error.message || `Could not remove rate plan ${row.code}.`);
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
              tone: getTone({ availability: nextAvailability, base_rate: Number(nextBaseRate) }, index),
            };
          }),
        };
      }),
    );
  }

  function shiftCalendar(daysToShift) {
    const current = new Date(calendarStartDate);
    current.setDate(current.getDate() + daysToShift);
    setCalendarStartDate(current.toISOString().slice(0, 10));
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

    if (!bulkForm.base_rate.trim() && !bulkForm.availability.trim()) {
      setBulkError("Enter a rate, availability, or both for the bulk update.");
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
            if (cell.stay_date < bulkForm.start_date || cell.stay_date > bulkForm.end_date) {
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
              tone: getTone({ availability: nextAvailability, base_rate: Number(nextBaseRate) }, index),
            };
          }),
        };
      }),
    );

    setBulkError("");
    setBulkSuccess(updatedCount ? `Queued ${updatedCount} calendar cells for update.` : "No cells matched the selected range.");
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
          groups[row.code] = changedItems;
        }

        return groups;
      }, {});

      await Promise.all(
        Object.entries(payloadsByRateId).map(([rateId, items]) =>
          fetchJson(`/rate-plans/${rateId}/calendar/bulk-upsert`, {
            method: "POST",
            body: JSON.stringify({ items }),
          }),
        ),
      );

      setPublishSuccess(`Published ${pendingChanges} calendar change${pendingChanges === 1 ? "" : "s"}.`);

      await refreshDailyRates(selectedProperty || propertyId || "");
    } catch (error) {
      setPublishError(error.message || "Could not publish calendar changes.");
    } finally {
      setPublishing(false);
    }
  }

  const summaryStats = useMemo(() => {
    const visibleRows = availableRows.length ? availableRows : apiConnected ? [] : fallbackRows;
    const allCells = visibleRows.flatMap((row) => row.cells.slice(0, range));
    const numericRates = allCells
      .map((cell) => Number(cell.base_rate ?? String(cell.value).replace(/[^0-9.]/g, "")))
      .filter((value) => !Number.isNaN(value) && value > 0);
    const adr = numericRates.length
      ? numericRates.reduce((sum, value) => sum + value, 0) / numericRates.length
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
    [apiConnected, availableRows.length, calendarStartDate, properties.length, rooms.length, selectedProperty],
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

  return (
    <PmsShell
      searchPlaceholder="Search rooms or guests..."
      sidebarMetricLabel="Rate Plans Loaded"
      sidebarMetricValue={`${availableRows.length}`}
      sidebarMetricProgress={Math.max(20, Math.min(100, availableRows.length * 20))}
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
            Open daily rates with a `property_id` to view and manage rate plans for a property.
          </p>
          <div className="mt-6 flex justify-center">
            <a
              href="/properties"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Go to Properties
            </a>
          </div>
        </section>
      ) : (
      <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <span className="material-symbols-outlined text-base">sell</span>
            Revenue Control Desk
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Daily Rates &amp; Yield</h2>
          <p className="max-w-3xl text-sm text-slate-500">
            This screen now consumes a property-level FastAPI daily-rates feed and
            shows all rooms with their linked rate plans.
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
            {loadingRates ? "Refreshing..." : apiConnected ? "FastAPI Live" : "Fallback Mode"}
          </div>
          <button
            type="button"
            onClick={publishChanges}
            disabled={publishing || !pendingChanges}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined">publish</span>
            {publishing ? "Publishing..." : `Publish Changes${pendingChanges ? ` (${pendingChanges})` : ""}`}
          </button>
        </div>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryStats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </section>

      <section className="mb-6 grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
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
                <p className="mt-1 font-mono text-xs text-slate-700">/api/v1/meal-plans</p>
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

        <div className="grid gap-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Active Room List</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Only live rooms are shown here and only live rooms can receive rate plans.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
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
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{room.room_name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[room.room_id, `$${Number(room.base_rate || 0).toFixed(2)}`, `${room.linked_rate_plan_count} plans`].join(" • ")}
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
                      <span className="material-symbols-outlined text-base">edit_square</span>
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
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">Bulk Editor</h3>
            <p className="mt-1 text-sm text-slate-500">
              Queue a date-range update for one rate plan, then publish all pending changes.
            </p>
            <form onSubmit={applyBulkChanges} className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Rate Plan</span>
                <select
                  value={bulkForm.rate_id}
                  onChange={(event) => {
                    setBulkForm((current) => ({ ...current, rate_id: event.target.value }));
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
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Start Date</span>
                  <input
                    type="date"
                    value={bulkForm.start_date}
                    onChange={(event) => setBulkForm((current) => ({ ...current, start_date: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">End Date</span>
                  <input
                    type="date"
                    value={bulkForm.end_date}
                    onChange={(event) => setBulkForm((current) => ({ ...current, end_date: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                  />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Base Rate</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bulkForm.base_rate}
                    onChange={(event) => setBulkForm((current) => ({ ...current, base_rate: event.target.value }))}
                    placeholder="Leave blank to keep"
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Availability</span>
                  <select
                    value={bulkForm.availability}
                    onChange={(event) => setBulkForm((current) => ({ ...current, availability: event.target.value }))}
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
            {bulkError ? <p className="mt-3 text-sm font-medium text-rose-600">{bulkError}</p> : null}
            {bulkSuccess ? <p className="mt-3 text-sm font-medium text-emerald-600">{bulkSuccess}</p> : null}
          </article>
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

      <section className="sticky top-[73px] z-20 flex h-[calc(100vh-97px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-4">
          <div className="flex min-w-0 flex-col">
            <h3 className="text-lg font-bold text-slate-900">Rate Matrix</h3>
                <p className="text-sm text-slate-500">
              Edit live-room rates day by day, or queue bulk changes from the editor.
                </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {[7, 15, 30].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setRange(size);
                    setSelectedDateIndex(0);
                  }}
                  className={[
                    "rounded-lg px-3 py-2 text-sm transition-all",
                    range === size
                      ? "bg-slate-900 font-bold text-white shadow-sm"
                      : "font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                  ].join(" ")}
                >
                  {size} Days
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm">
              <span className="material-symbols-outlined text-base text-slate-400">calendar_month</span>
              <input
                type="date"
                value={selectedStayDate}
                onChange={(event) => handleSelectedDateChange(event.target.value)}
                className="bg-transparent text-slate-900 outline-none"
              />
            </label>
            <label className="flex min-w-[250px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm">
              <span className="material-symbols-outlined text-base text-slate-400">search</span>
              <input
                type="text"
                value={rateMatrixSearch}
                onChange={(event) => setRateMatrixSearch(event.target.value)}
                placeholder="Search rate ID, room name, or room ID"
                className="w-full bg-transparent text-slate-900 outline-none"
              />
            </label>
          </div>
        </div>
        {publishError ? (
          <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
            {publishError}
          </div>
        ) : null}
        {publishSuccess ? (
          <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-700">
            {publishSuccess}
          </div>
        ) : null}


        <div className="min-h-0 flex-1 overflow-y-auto">
          <div
            ref={matrixScrollRef}
            onMouseDown={handleMatrixMouseDown}
            onMouseMove={handleMatrixMouseMove}
            onMouseUp={handleMatrixMouseUp}
            onMouseLeave={handleMatrixMouseUp}
            className="custom-scrollbar cursor-grab select-none overflow-x-auto overflow-y-visible active:cursor-grabbing"
          >
            <div
              className="min-w-max overflow-visible"
              style={{
                width: `${matrixRoomColumnWidth + visibleDays.length * matrixDayColumnWidth}px`,
              }}
            >
              <div
                className="sticky top-0 z-30 grid"
                style={{
                  gridTemplateColumns: `${matrixRoomColumnWidth}px repeat(${visibleDays.length}, ${matrixDayColumnWidth}px)`,
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(244,247,250,0.92) 100%)",
                  borderBottom: "1px solid rgba(148, 163, 184, 0.16)",
                  backdropFilter: "blur(14px)",
                }}
              >
              <div
                className="sticky left-0 z-40 flex min-h-[76px] items-center px-5 py-4 text-left"
                style={{
                  borderRight: "1px solid rgba(148, 163, 184, 0.16)",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(243,246,249,0.94) 100%)",
                  boxShadow: "2px 0 10px rgba(15,23,42,0.08)",
                }}
              >
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Rate Plan
                </p>
              </div>
              {visibleDays.map((day, index) => {
                const isToday = index === 0;
                const isSelected = index === selectedDateIndex;
                const weekend = day.shortDay === "Sat" || day.shortDay === "Sun";
                return (
                  <button
                    type="button"
                    key={day.isoDate}
                    onClick={() => setSelectedDateIndex(index)}
                    className="min-w-[48px] p-3 text-center"
                    style={{
                      borderRight: "1px solid rgba(148, 163, 184, 0.10)",
                      backgroundColor: isSelected
                        ? "rgba(15, 23, 42, 0.06)"
                        : weekend
                          ? "rgba(248, 250, 252, 0.88)"
                          : "transparent",
                    }}
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-[10px] text-slate-500">
                        {day.shortDay.toUpperCase()}
                      </span>
                      <span className="mt-1 text-lg font-bold text-slate-800">
                        {day.dayNum}
                      </span>
                      {isToday ? (
                        <span className="mt-1 rounded-full bg-slate-900 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
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
                  gridTemplateColumns: `${matrixRoomColumnWidth}px repeat(${visibleDays.length}, ${matrixDayColumnWidth}px)`,
                  background: "rgba(248, 250, 252, 0.94)",
                  borderBottom: "1px solid rgba(148, 163, 184, 0.14)",
                  backdropFilter: "blur(12px)",
                }}
              >
              <div
                className="sticky left-0 z-30 px-5 py-5"
                style={{
                  borderRight: "1px solid rgba(148, 163, 184, 0.16)",
                  background:
                    "linear-gradient(180deg, rgba(248,250,252,0.98) 0%, rgba(241,245,249,0.94) 100%)",
                  boxShadow: "2px 0 10px rgba(15,23,42,0.06)",
                }}
              >
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Hotel Summary
                </p>
                <p className="mt-1 text-sm font-bold text-slate-900">{propertyName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Current live-room availability by date
                </p>
              </div>
              {visibleInventorySummary.map((summary, index) => {
                const isSelected = index === selectedDateIndex;
                return (
                  <button
                    type="button"
                    key={summary.stay_date}
                    className="px-3 py-3"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      const popupWidth = 220;
                      const popupLeft = Math.min(
                        rect.right + 10,
                        window.innerWidth - popupWidth - 16,
                      );
                      const popupTop = Math.min(
                        rect.top,
                        window.innerHeight - 260,
                      );
                      setSummaryPopover((current) =>
                        current?.stayDate === summary.stay_date
                          ? null
                          : {
                              stayDate: summary.stay_date,
                              left: Math.max(16, popupLeft),
                              top: Math.max(16, popupTop),
                              summary,
                            },
                      );
                    }}
                    style={{
                      borderRight: "1px solid rgba(148, 163, 184, 0.10)",
                      backgroundColor: isSelected ? "rgba(15, 23, 42, 0.04)" : "rgba(255,255,255,0.72)",
                    }}
                  >
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                      <div className="flex min-h-[86px] flex-col items-center justify-center rounded-xl bg-slate-100/80 text-center text-slate-700">
                        <span className="material-symbols-outlined text-[22px]">sell</span>
                        <span className="mt-2 text-[22px] font-bold leading-none text-slate-900">
                          {summary.total_active_rate}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
              </div>

              {summaryPopover ? (
                <div
                  className="fixed z-50 w-[220px] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur"
                  style={{
                    left: `${summaryPopover.left}px`,
                    top: `${summaryPopover.top}px`,
                  }}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      {summaryPopover.stayDate}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSummaryPopover(null)}
                      className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {[
                      ["meeting_room", "Active Rooms", summaryPopover.summary.total_active_room, "bg-emerald-50 text-emerald-700", "text-emerald-800"],
                      ["sell", "Active Rates", summaryPopover.summary.total_active_rate, "bg-blue-50 text-blue-700", "text-blue-800"],
                      ["bed", "Booked", summaryPopover.summary.booked_room, "bg-amber-50 text-amber-700", "text-amber-800"],
                      ["block", "Unavailable", summaryPopover.summary.unavailable_room, "bg-rose-50 text-rose-700", "text-rose-800"],
                      ["inventory_2", "Available", summaryPopover.summary.available_room, "bg-slate-100 text-slate-700", "text-slate-900"],
                    ].map(([icon, label, value, toneClass, valueClass], metricIndex) => (
                      <div
                        key={`${summaryPopover.stayDate}-${metricIndex}`}
                        className={`flex min-h-[42px] items-center justify-between rounded-xl px-3 py-2 ${toneClass}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px]">{icon}</span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em]">{label}</span>
                        </div>
                        <span className={`text-[15px] font-bold leading-none ${valueClass}`}>{value}</span>
                      </div>
                    ))}
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
                    gridTemplateColumns: `${matrixRoomColumnWidth}px repeat(${visibleDays.length}, ${matrixDayColumnWidth}px)`,
                  }}
                >
                  <div
                    className="sticky left-0 z-20 flex flex-col justify-center px-5 py-4"
                    style={{
                      minHeight: "154px",
                      borderRight: "1px solid rgba(148, 163, 184, 0.16)",
                      borderBottom: "1px solid rgba(148, 163, 184, 0.10)",
                      background:
                        rowIndex % 2 === 0
                          ? "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(248,244,248,0.92) 100%)"
                          : "linear-gradient(135deg, rgba(252,250,252,0.96) 0%, rgba(243,238,243,0.92) 100%)",
                      boxShadow: "2px 0 10px rgba(15,23,42,0.06)",
                    }}
                  >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{row.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {[row.roomLabel, row.code, row.subtitle].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      {row.occupancy}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs font-medium text-slate-500">
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
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => handleRemoveRatePlan(row)}
                      disabled={!apiConnected || publishing || deletingRateId === row.code}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      {deletingRateId === row.code ? "Removing..." : "Remove Plan"}
                    </button>
                  </div>
                  </div>

                  {row.cells.slice(0, range).map((cell, index) =>
                    renderInventoryStyleRateCell(row, cell, index),
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>
      {showRatePlanModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Rate Plan</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">
                  {ratePlanModalMode === "edit" ? "Edit Rate Plan for" : "Add Rate Plan for"}{" "}
                  {selectedRoomForRatePlan?.room_name || selectedRoomForRatePlan?.room_id}
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
            <form onSubmit={handleSubmitRatePlan} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Room ID</span>
                  <input
                    value={newRatePlanForm.room_id}
                    readOnly
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Rate ID</span>
                  <input
                    value={newRatePlanForm.rate_id || (ratePlanModalMode === "edit" ? editingRatePlanId : "Auto-generated")}
                    readOnly
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                  />
                </label>
              </div>
              {loadingRatePlanDetails ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
                  Loading full rate plan details...
                </p>
              ) : null}
              <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-3.5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Room Summary</p>
                    <h4 className="mt-1 text-sm font-bold text-slate-900">
                      {selectedRoomForRatePlan?.room_name || selectedRoomForRatePlan?.room_id || "Selected Room"}
                    </h4>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {[
                        selectedRoomForRatePlan?.room_id,
                        selectedRoomForRatePlan?.room_name_lang,
                        selectedRoomForRatePlan?.room_status,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Total Room Amount</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {formatMoneyWithCurrency(
                        newRatePlanForm.currency || "USD",
                        Number(selectedRoomForRatePlan?.base_rate || 0) +
                          Number(selectedRoomForRatePlan?.tax_and_service_fee || 0) +
                          Number(selectedRoomForRatePlan?.surcharges || 0) +
                          Number(selectedRoomForRatePlan?.mandatory_fee || 0) +
                          Number(selectedRoomForRatePlan?.resort_fee || 0) +
                          Number(selectedRoomForRatePlan?.mandatory_tax || 0),
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 grid gap-2 md:grid-cols-6">
                  {[
                    ["Base Rate --", selectedRoomForRatePlan?.base_rate || 0],
                    ["Tax & Service", selectedRoomForRatePlan?.tax_and_service_fee || 0],
                    ["Surcharges --", selectedRoomForRatePlan?.surcharges || 0],
                    ["Mandatory Fee", selectedRoomForRatePlan?.mandatory_fee || 0],
                    ["Resort Fee", selectedRoomForRatePlan?.resort_fee || 0],
                    ["Mandatory Tax", selectedRoomForRatePlan?.mandatory_tax || 0],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-white px-2.5 py-2 shadow-sm">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-900">
                        {formatMoneyWithCurrency(newRatePlanForm.currency || "USD", value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Rate Details</p>
                <div className="mt-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-1">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Title</span>
                      <input
                        value={newRatePlanForm.title}
                        onChange={(event) => setNewRatePlanForm((current) => ({ ...current, title: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</span>
                    <textarea
                      value={newRatePlanForm.description}
                      onChange={(event) => setNewRatePlanForm((current) => ({ ...current, description: event.target.value }))}
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                    />
                  </label>
                  <div className="grid gap-4 md:grid-cols-4">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Meal Plan</span>
                      <select
                        value={newRatePlanForm.meal_plan}
                        onChange={(event) =>
                          setNewRatePlanForm((current) => ({ ...current, meal_plan: event.target.value }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none"
                      >
                        {mealPlanOptions.map((mealPlan) => (
                          <option key={mealPlan.value} value={mealPlan.value}>
                            {mealPlan.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {[
                      ["bed_type", "Bed Type"],
                      ["currency", "Currency"],
                      ["cancellation_policy", "Cancellation"],
                    ].map(([field, label]) => (
                      <label key={field} className="block">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
                        <input
                          value={newRatePlanForm[field]}
                          onChange={(event) => setNewRatePlanForm((current) => ({ ...current, [field]: event.target.value }))}
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
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newRatePlanForm[field]}
                          onChange={(event) => setNewRatePlanForm((current) => ({ ...current, [field]: event.target.value }))}
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
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={newRatePlanForm[field]}
                          onChange={(event) => setNewRatePlanForm((current) => ({ ...current, [field]: event.target.value }))}
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
                      <label key={field} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(newRatePlanForm[field])}
                          onChange={(event) => setNewRatePlanForm((current) => ({ ...current, [field]: event.target.checked }))}
                          className="size-4 rounded border-slate-300"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              {ratePlanModalError ? (
                <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {ratePlanModalError}
                </p>
              ) : null}
              {ratePlanModalSuccess ? (
                <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {ratePlanModalSuccess}
                </p>
              ) : null}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Preview</p>
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
                        newRatePlanForm.room_id || selectedRoomForRatePlan?.room_id,
                        newRatePlanForm.meal_plan || "Meal plan pending",
                        newRatePlanForm.bed_type || "Bed type pending",
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>
                  <div className="w-full rounded-2xl bg-white px-4 py-3 text-right shadow-sm md:max-w-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Subtotal Price</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {formatMoneyWithCurrency(newRatePlanForm.currency, ratePlanPreview.subtotal)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Base + tax/service + surcharges + mandatory fees
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Price Breakdown</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <div className="flex items-center justify-between">
                        <span>Base rate</span>
                        <span className="font-bold text-slate-900">{formatMoneyWithCurrency(newRatePlanForm.currency, ratePlanPreview.baseRate)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Tax & service</span>
                        <span className="font-bold text-slate-900">{formatMoneyWithCurrency(newRatePlanForm.currency, ratePlanPreview.taxAndServiceFee)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Surcharges</span>
                        <span className="font-bold text-slate-900">{formatMoneyWithCurrency(newRatePlanForm.currency, ratePlanPreview.surcharges)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Mandatory fee</span>
                        <span className="font-bold text-slate-900">{formatMoneyWithCurrency(newRatePlanForm.currency, ratePlanPreview.mandatoryFee)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Resort fee</span>
                        <span className="font-bold text-slate-900">{formatMoneyWithCurrency(newRatePlanForm.currency, ratePlanPreview.resortFee)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Mandatory tax</span>
                        <span className="font-bold text-slate-900">{formatMoneyWithCurrency(newRatePlanForm.currency, ratePlanPreview.mandatoryTax)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Inventory Snapshot</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        ["Total", ratePlanPreview.totalInventory],
                        ["Available", ratePlanPreview.availableInventory],
                        ["Sold", ratePlanPreview.soldInventory],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-slate-50 px-3 py-3 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                          <p className="mt-1 text-base font-bold text-slate-900">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                      Stay window: <span className="font-bold text-slate-900">{ratePlanPreview.minStay}</span> to{" "}
                      <span className="font-bold text-slate-900">{ratePlanPreview.maxStay}</span> nights
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Flags & Policy</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        newRatePlanForm.status ? "Active" : "Inactive",
                        newRatePlanForm.is_refundable ? "Refundable" : "Non-refundable",
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
                        Cancellation: <span className="font-bold text-slate-900">{newRatePlanForm.cancellation_policy || "Not set"}</span>
                      </p>
                      <p>
                        Extra adult: <span className="font-bold text-slate-900">{formatMoneyWithCurrency(newRatePlanForm.currency, newRatePlanForm.extra_adult_rate)}</span>
                      </p>
                      <p>
                        Extra child: <span className="font-bold text-slate-900">{formatMoneyWithCurrency(newRatePlanForm.currency, newRatePlanForm.extra_child_rate)}</span>
                      </p>
                    </div>
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
                  {savingNewRatePlan ? "Saving..." : ratePlanModalMode === "edit" ? "Save Rate Plan" : "Create Rate Plan"}
                </button>
              </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {activeRoomPlansModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Rate Plan List</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">
                  {activeRoomPlansModal.room_name} · {activeRoomPlansModal.room_id}
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
              {(activeRoomPlansModal.linked_rate_plans || []).map((plan) => (
                <button
                  type="button"
                  key={plan.code}
                  onClick={() => openEditRatePlanModal(activeRoomPlansModal, plan)}
                  className="block w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base font-bold text-slate-900">{plan.title}</h4>
                      <p className="mt-1 text-xs text-slate-500">
                        {[plan.code, plan.roomLabel, plan.strategy].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      {plan.stopSell ? "Stopped" : "Active"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-white px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rate ID</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{plan.code}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Base Rate</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {plan.cells?.[0]?.currency || "USD"} {plan.cells?.[0]?.base_rate || "0.00"}
                      </p>
                    </div>
                    {/* <div className="rounded-xl bg-white px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Occupancy</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{plan.occupancy}</p>
                    </div> */}
                    <div className="rounded-xl bg-white px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Flags</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {[plan.stopSell && "Stop Sell", plan.cta && "CTA", plan.ctd && "CTD"].filter(Boolean).join(", ") || "None"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs font-semibold text-slate-500">
                    <span>Click this rate plan to edit all fields.</span>
                    <span className="inline-flex items-center gap-1 text-slate-900">
                      <span className="material-symbols-outlined text-sm">edit_square</span>
                      Edit full plan
                    </span>
                  </div>
                </button>
              ))}

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
    </PmsShell>
  );
}
