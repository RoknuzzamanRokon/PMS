"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PmsShell } from "./pms-shell";
import { fetchJson } from "../lib/api";

const dayColumnWidth = 100;
const inventoryViewOptions = [7, 15, 30];

const bookingToneClasses = {
  blue: {
    dot: "bg-blue-500",
    card: "border-blue-500 bg-gradient-to-br from-blue-400/25 via-blue-300/20 to-cyan-200/20 shadow-[0_10px_24px_-18px_rgba(37,99,235,0.9)] hover:from-blue-400/35 hover:via-blue-300/25 hover:to-cyan-200/30",
    title: "text-blue-700",
    meta: "text-blue-600",
    badge: "bg-blue-500 text-white",
  },
  green: {
    dot: "bg-green-500",
    card: "border-green-500 bg-gradient-to-br from-emerald-400/25 via-green-300/20 to-lime-200/20 shadow-[0_10px_24px_-18px_rgba(34,197,94,0.9)] hover:from-emerald-400/35 hover:via-green-300/25 hover:to-lime-200/30",
    title: "text-green-700",
    meta: "text-green-600",
    badge: "bg-green-500 text-white",
  },
  amber: {
    dot: "bg-amber-400",
    card: "border-amber-400 bg-gradient-to-br from-amber-300/35 via-yellow-200/30 to-orange-200/25 shadow-[0_10px_24px_-18px_rgba(245,158,11,0.85)] hover:from-amber-300/45 hover:via-yellow-200/35 hover:to-orange-200/30",
    title: "text-amber-700",
    meta: "text-amber-700",
    badge: "bg-amber-400 text-slate-900",
  },
};

function buildDays(startDate, totalDays) {
  const start = new Date(startDate);
  return Array.from({ length: totalDays }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const today = index === 0;
    const shortDay = current.toLocaleDateString("en-US", { weekday: "short" });
    return {
      label: today ? "Today" : shortDay,
      date: current.toLocaleDateString("en-US", { day: "2-digit", month: "short" }),
      isoDate: toIsoDate(current),
      today,
      weekend: shortDay === "Sat" || shortDay === "Sun",
    };
  });
}

function toIsoDate(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function addDaysToIsoDate(startDate, offsetDays) {
  const date = new Date(startDate);
  date.setDate(date.getDate() + offsetDays);
  return toIsoDate(date);
}

function formatCurrency(value, currency = "USD") {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function getNightCount(checkInDate, checkOutDate) {
  if (!checkInDate || !checkOutDate) {
    return 0;
  }
  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  const milliseconds = end.getTime() - start.getTime();
  return Math.max(0, Math.round(milliseconds / (1000 * 60 * 60 * 24)));
}

const fallbackCalendar = {
  property: { property_id: "", name: "Selected Property" },
  start_date: new Date().toISOString().slice(0, 10),
  days: 15,
  rows: [],
};

export function InventoryPage({ propertyId }) {
  const selectedPropertyId = propertyId || "";
  const hasSelectedProperty = Boolean(selectedPropertyId);
  const [calendar, setCalendar] = useState(fallbackCalendar);
  const [selectedDays, setSelectedDays] = useState(15);
  const [apiConnected, setApiConnected] = useState(false);
  const [savingBookingId, setSavingBookingId] = useState("");
  const [calendarError, setCalendarError] = useState("");
  const [calendarSuccess, setCalendarSuccess] = useState("");
  const [dragState, setDragState] = useState(null);
  const [ignoreNextClickBookingId, setIgnoreNextClickBookingId] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editForm, setEditForm] = useState({
    check_in_date: "",
    check_out_date: "",
    booking_status: "CONFIRMED",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(null);
  const [bookingPayments, setBookingPayments] = useState([]);
  const [loadingBookingDetails, setLoadingBookingDetails] = useState(false);
  const [availableDateKeys, setAvailableDateKeys] = useState(new Set());
  const [availableRateDateKeys, setAvailableRateDateKeys] = useState(new Set());

  async function loadCalendar() {
    if (!selectedPropertyId) {
      setCalendar(fallbackCalendar);
      setApiConnected(false);
      return;
    }

    try {
      const data = await fetchJson(
        `/inventory/calendar?property_id=${encodeURIComponent(selectedPropertyId)}&days=${selectedDays}`,
      );
      setCalendar(data);
      setApiConnected(true);
    } catch {
      setApiConnected(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function loadCalendar() {
      if (!selectedPropertyId) {
        if (!ignore) {
          setCalendar(fallbackCalendar);
          setApiConnected(false);
        }
        return;
      }

      try {
        const data = await fetchJson(
          `/inventory/calendar?property_id=${encodeURIComponent(selectedPropertyId)}&days=${selectedDays}`,
        );
        if (!ignore) {
          setCalendar(data);
          setApiConnected(true);
        }
      } catch {
        if (!ignore) {
          setApiConnected(false);
        }
      }
    }

    loadCalendar();
    return () => {
      ignore = true;
    };
  }, [selectedDays, selectedPropertyId]);

  useEffect(() => {
    let ignore = false;

    async function loadAvailabilityDates() {
      if (!selectedPropertyId) {
        if (!ignore) {
          setAvailableDateKeys(new Set());
          setAvailableRateDateKeys(new Set());
        }
        return;
      }

      try {
        const data = await fetchJson(
          `/search/available-dates?property_id=${encodeURIComponent(selectedPropertyId)}&start_date=${encodeURIComponent(
            calendar.start_date,
          )}&days=${selectedDays}`,
        );
        if (ignore) {
          return;
        }

        const nextDateKeys = new Set();
        const nextRateDateKeys = new Set();
        for (const item of data.availability || []) {
          if (!item?.date) {
            continue;
          }
          nextDateKeys.add(item.date);
          for (const room of item.rooms || []) {
            for (const rate of room.rates || []) {
              if (room.room_id && rate.rate_id) {
                nextRateDateKeys.add(`${room.room_id}::${rate.rate_id}::${item.date}`);
              }
            }
          }
        }

        setAvailableDateKeys(nextDateKeys);
        setAvailableRateDateKeys(nextRateDateKeys);
      } catch {
        if (!ignore) {
          setAvailableDateKeys(new Set());
          setAvailableRateDateKeys(new Set());
        }
      }
    }

    loadAvailabilityDates();
    return () => {
      ignore = true;
    };
  }, [calendar.start_date, selectedDays, selectedPropertyId]);

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    function clampLeftDays(leftDays, durationDays) {
      return Math.max(0, Math.min(leftDays, Math.max(calendar.days - durationDays, 0)));
    }

    function handlePointerMove(event) {
      setDragState((current) => {
        if (!current) {
          return current;
        }

        const deltaDays = Math.round((event.clientX - current.startX) / dayColumnWidth);
        const targetElement = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest?.("[data-booking-drop-target='true']");
        const nextTargetRoomId =
          targetElement?.getAttribute("data-room-id") || current.targetRoomId;
        const nextTargetRateId =
          targetElement?.getAttribute("data-rate-id") || current.targetRateId;
        return {
          ...current,
          hasMoved:
            current.hasMoved ||
            deltaDays !== 0 ||
            nextTargetRoomId !== current.originalRoomId ||
            nextTargetRateId !== current.originalRateId,
          previewLeftDays: clampLeftDays(current.originalLeftDays + deltaDays, current.durationDays),
          targetRoomId: nextTargetRoomId,
          targetRateId: nextTargetRateId,
        };
      });
    }

    async function handlePointerUp() {
      const currentDrag = dragState;
      setDragState(null);

      if (
        !currentDrag ||
        (
          currentDrag.previewLeftDays === currentDrag.originalLeftDays &&
          currentDrag.targetRoomId === currentDrag.originalRoomId &&
          currentDrag.targetRateId === currentDrag.originalRateId
        )
      ) {
        return;
      }

      if (currentDrag.hasMoved) {
        setIgnoreNextClickBookingId(currentDrag.bookingId);
        window.setTimeout(() => setIgnoreNextClickBookingId(""), 150);
      }

      const nextCheckInDate = addDaysToIsoDate(calendar.start_date, currentDrag.previewLeftDays);
      const nextCheckOutDate = addDaysToIsoDate(nextCheckInDate, currentDrag.durationDays);

      setSavingBookingId(currentDrag.bookingId);
      setCalendarError("");
      setCalendarSuccess("");

      try {
        const updatedReservation = await fetchJson(`/reservations/${encodeURIComponent(currentDrag.bookingId)}`, {
          method: "PATCH",
          body: JSON.stringify({
            check_in_date: nextCheckInDate,
            check_out_date: nextCheckOutDate,
            room_id: currentDrag.targetRoomId,
            rate_id: currentDrag.targetRateId,
          }),
        });
        await loadCalendar();
        setCalendarSuccess(
          `Updated ${updatedReservation.booking_id || currentDrag.bookingId} to ${updatedReservation.check_in_date || nextCheckInDate} - ${updatedReservation.check_out_date || nextCheckOutDate} on ${currentDrag.targetRoomId}/${currentDrag.targetRateId}.`,
        );
      } catch (error) {
        await loadCalendar();
        setCalendarError(error.message || `Could not update ${currentDrag.bookingId}.`);
      } finally {
        setSavingBookingId("");
      }
    }

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [calendar.days, calendar.start_date, dragState, selectedPropertyId]);

  const days = useMemo(
    () => buildDays(calendar.start_date, calendar.days),
    [calendar.days, calendar.start_date],
  );
  const roomCalendarGroups = useMemo(() => {
    const groups = new Map();

    for (const row of calendar.rows) {
      if (!groups.has(row.room_id)) {
        groups.set(row.room_id, {
          room_id: row.room_id,
          room_name: row.room_name,
          rate_ids: row.rate_ids || [],
          rates: row.rates || [],
          bookingsByRate: new Map(),
        });
      }

      const group = groups.get(row.room_id);
      if (row.booking?.rate_id) {
        const bookings = group.bookingsByRate.get(row.booking.rate_id) || [];
        bookings.push(row.booking);
        group.bookingsByRate.set(row.booking.rate_id, bookings);
      }
    }

    return Array.from(groups.values()).map((group) => {
      const rateRows = (group.rates || []).length
        ? group.rates.map((rate) => ({
            ...rate,
            bookings: group.bookingsByRate.get(rate.rate_id) || [],
          }))
        : [
            {
              rate_id: "",
              title: "No linked rates",
              bookings: [],
              empty: true,
            },
          ];

      return {
        ...group,
        rateRows,
      };
    }).filter((group) => (group.rates || []).length > 0);
  }, [calendar.rows]);

  async function openBookingEditor(booking, row) {
    if (!booking) {
      return;
    }
    const nextSelectedBooking = {
      ...booking,
      room_id: row?.room_id || "",
      room_name: row?.room_name || "",
    };
    setSelectedBooking(nextSelectedBooking);
    setEditForm({
      check_in_date: booking.check_in_date,
      check_out_date: booking.check_out_date,
      booking_status: booking.booking_status || "CONFIRMED",
    });
    setBookingDetails(null);
    setBookingPayments([]);
    setLoadingBookingDetails(true);
    setCalendarError("");
    setCalendarSuccess("");

    try {
      const [reservation, payments] = await Promise.all([
        fetchJson(`/reservations/${encodeURIComponent(booking.booking_id)}`),
        fetchJson(`/reservations/${encodeURIComponent(booking.booking_id)}/payments`).catch(() => []),
      ]);
      setBookingDetails(reservation);
      setBookingPayments(Array.isArray(payments) ? payments : []);
    } catch (error) {
      setCalendarError(error.message || `Could not load ${booking.booking_id} details.`);
    } finally {
      setLoadingBookingDetails(false);
    }
  }

  function closeBookingEditor() {
    setSelectedBooking(null);
    setBookingDetails(null);
    setBookingPayments([]);
    setLoadingBookingDetails(false);
    setSavingEdit(false);
  }

  async function handleSaveBookingEditor(event) {
    event.preventDefault();
    if (!selectedBooking?.booking_id) {
      return;
    }
    const bookingId = selectedBooking.booking_id;

    setSavingEdit(true);
    setCalendarError("");
    setCalendarSuccess("");

    try {
      await fetchJson(`/reservations/${encodeURIComponent(bookingId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          check_in_date: editForm.check_in_date,
          check_out_date: editForm.check_out_date,
          booking_status: editForm.booking_status,
        }),
      });
      closeBookingEditor();
      await loadCalendar();
      setCalendarSuccess(`Updated ${bookingId} successfully.`);
    } catch (error) {
      setCalendarError(error.message || `Could not update ${bookingId}.`);
      setSavingEdit(false);
    }
  }

  const bookingPaidTotal = useMemo(
    () => bookingPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [bookingPayments],
  );
  const bookingTotalPrice = Number(bookingDetails?.total_price || 0);
  const bookingCurrency = bookingDetails?.currency || "USD";
  const bookingDueTotal = Math.max(bookingTotalPrice - bookingPaidTotal, 0);
  const bookingNightCount = getNightCount(editForm.check_in_date, editForm.check_out_date);

  return (
    <PmsShell
      searchPlaceholder="Search rooms or guests..."
      sidebarMetricLabel="Calendar Rows"
      sidebarMetricValue={`${calendar.rows.length}`}
      sidebarMetricProgress={Math.max(20, Math.min(100, calendar.rows.length * 18))}
    >
      {!hasSelectedProperty ? (
        <section className="mb-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <span className="material-symbols-outlined text-4xl text-slate-400">
            calendar_month
          </span>
          <h3 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Select a property first
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Open inventory with a `property_id` to view the booking calendar for a property.
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
      <div className="-m-6 flex min-h-[calc(100vh-108px)] flex-col overflow-hidden lg:-m-8">
        <div className="border-b border-slate-200 bg-white px-6 py-6 dark:border-slate-700 dark:bg-slate-900/80 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Inventory Calendar
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Real bookings by room from `/api/v1/inventory/calendar` for {calendar.property.name}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/properties"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                >
                  <span className="material-symbols-outlined text-base">arrow_back</span>
                  Back to Properties
                </Link>
                <div className="inline-flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
                  <span className="material-symbols-outlined text-base">pin_drop</span>
                  Viewing {calendar.property.name}
                </div>
                <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70">
                  {inventoryViewOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedDays(option)}
                      className={[
                        "px-3 py-2 text-sm font-bold transition-colors",
                        selectedDays === option
                          ? "bg-primary text-white"
                          : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white",
                      ].join(" ")}
                    >
                      {option} Days
                    </button>
                  ))}
                </div>
              </div>
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
                {apiConnected ? "view_timeline" : "cloud_off"}
              </span>
              {apiConnected ? "Inventory API Live" : "Using Local Fallback"}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {[
              ["filter_alt", "Property:", calendar.property.property_id],
              ["calendar_month", "Start:", calendar.start_date],
              ["date_range", "View:", `${calendar.days} days`],
              ["hotel", "Rows:", `${calendar.rows.length}`],
              ["link", "Endpoint:", `/inventory/calendar?property_id=${selectedPropertyId}&days=${selectedDays}`],
            ].map(([icon, label, value]) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800/70"
              >
                <span className="material-symbols-outlined text-lg text-slate-400">
                  {icon}
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{label}</span>
                <span className="text-xs font-medium text-primary">{value}</span>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-6">
              {[
                ["blue", "Confirmed"],
                ["green", "Checked-in"],
                ["amber", "Pending"],
              ].map(([tone, label]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${bookingToneClasses[tone].dot}`} />
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-auto bg-slate-50 dark:bg-slate-950/40">
          <div className="min-w-max">
            <div
              className="calendar-grid sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/95"
              style={{ "--inventory-days": calendar.days }}
            >
              <div className="flex items-center justify-between border-r border-slate-200 p-4 dark:border-slate-700">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Rooms
                </span>
                <span className="material-symbols-outlined text-sm text-slate-400">
                  unfold_more
                </span>
              </div>
              <div className="flex items-center justify-between border-r border-slate-200 p-4 dark:border-slate-700">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Rates
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                  Linked
                </span>
              </div>
              {days.map((day) => (
                <div
                  key={day.isoDate}
                  className="border-r border-slate-200 bg-transparent p-2 dark:border-slate-700"
                >
                  <div
                    className={[
                      "flex h-full flex-col items-center justify-center rounded-2xl border border-white/70 px-2 py-3 shadow-sm backdrop-blur dark:border-slate-700/70",
                      "bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-800/80",
                      day.today &&
                        "border-primary/30 bg-gradient-to-br from-primary/15 via-white to-sky-50 dark:from-primary/20 dark:via-slate-900 dark:to-sky-950/30",
                      day.weekend &&
                        "bg-gradient-to-br from-slate-100 via-white to-slate-200 dark:from-slate-800/90 dark:via-slate-900 dark:to-slate-800/70",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "text-[10px] font-bold uppercase",
                        day.today ? "text-primary" : "text-slate-400",
                      ].join(" ")}
                    >
                      {day.label}
                    </span>
                    <span
                      className={[
                        "text-sm font-bold",
                        day.today ? "text-primary" : "text-slate-800 dark:text-slate-200",
                      ].join(" ")}
                    >
                      {day.date}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {roomCalendarGroups.map((group) => (
                <div
                  key={group.room_id}
                  className="calendar-grid"
                  style={{
                    "--inventory-days": calendar.days,
                    gridTemplateRows: `repeat(${group.rateRows.length}, minmax(62px, auto))`,
                  }}
                >
                  <div
                    className="flex flex-col justify-center border-r border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/80"
                    style={{ gridRow: `1 / span ${group.rateRows.length}` }}
                  >
                    <span className="text-sm font-bold leading-none">{group.room_id}</span>
                    <span className="mt-1 text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                      {group.room_name}
                    </span>
                  </div>
                  {group.rateRows.map((rateRow, index) => (
                    <div
                      key={`${group.room_id}-${rateRow.rate_id || "empty"}-${index}`}
                      className="contents"
                    >
                      {(() => {
                        const isDropTargetRow =
                          dragState &&
                          dragState.targetRoomId === group.room_id &&
                          dragState.targetRateId === (rateRow.rate_id || "");
                        const displayBookings = (rateRow.bookings || [])
                          .filter((booking) => {
                            if (!dragState || dragState.bookingId !== booking.booking_id) {
                              return true;
                            }
                            return (
                              dragState.targetRoomId === group.room_id &&
                              dragState.targetRateId === (rateRow.rate_id || "")
                            );
                          })
                          .map((booking) =>
                            dragState?.bookingId === booking.booking_id
                              ? {
                                  ...booking,
                                  room_id: dragState.targetRoomId,
                                  rate_id: dragState.targetRateId,
                                  left_days: dragState.previewLeftDays,
                                }
                              : booking,
                          );

                        if (
                          isDropTargetRow &&
                          dragState?.booking &&
                          !displayBookings.some((booking) => booking.booking_id === dragState.bookingId)
                        ) {
                          displayBookings.push({
                            ...dragState.booking,
                            room_id: dragState.targetRoomId,
                            rate_id: dragState.targetRateId,
                            left_days: dragState.previewLeftDays,
                          });
                        }
                        return (
                          <>
                      <div
                        className="flex flex-col justify-center gap-1 border-r border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900/80"
                        style={{ gridColumn: 2, gridRow: index + 1 }}
                      >
                        {rateRow.empty ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[11px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-500">
                            No linked rates
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                              {rateRow.rate_id}
                            </p>
                            <p className="mt-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                              {rateRow.title}
                            </p>
                          </div>
                        )}
                      </div>
                        <div
                          className="relative h-full border-r border-slate-100 bg-transparent p-1 dark:border-slate-800"
                          data-booking-drop-target="true"
                          data-room-id={group.room_id}
                          data-rate-id={rateRow.rate_id || ""}
                          onMouseEnter={() => {
                            if (!dragState) {
                              return;
                            }
                            setDragState((current) =>
                              current
                                ? {
                                    ...current,
                                    targetRoomId: group.room_id,
                                    targetRateId: rateRow.rate_id || "",
                                    hasMoved:
                                      current.hasMoved ||
                                      group.room_id !== current.originalRoomId ||
                                      (rateRow.rate_id || "") !== current.originalRateId,
                                  }
                                : current,
                            );
                          }}
                          style={{
                            gridColumn: "3 / -1",
                            gridRow: index + 1,
                          display: "grid",
                          gridTemplateColumns: `repeat(${calendar.days}, minmax(${dayColumnWidth}px, 1fr))`,
                        }}
                      >
                        {days.map((day) => (
                          <div
                            key={`${group.room_id}-${rateRow.rate_id || "empty"}-${day.label}-${day.date}`}
                            className="pointer-events-none border-r border-slate-100 bg-transparent p-1 dark:border-slate-800"
                          >
                            {(() => {
                              const isAvailableRateDay =
                                !rateRow.empty &&
                                availableRateDateKeys.has(`${group.room_id}::${rateRow.rate_id}::${day.isoDate}`);
                              return (
                            <div
                              className={[
                                "h-full rounded-2xl border border-white/70 shadow-sm backdrop-blur dark:border-slate-700/60",
                                "bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-900/90 dark:via-slate-900/80 dark:to-slate-800/60",
                                day.today &&
                                  "bg-gradient-to-br from-primary/10 via-white to-sky-50 dark:from-primary/20 dark:via-slate-900/85 dark:to-sky-950/20",
                                day.weekend &&
                                  "bg-gradient-to-br from-slate-100 via-white to-slate-200 dark:from-slate-800/80 dark:via-slate-900/80 dark:to-slate-800/60",
                              ].join(" ")}
                              style={
                                isAvailableRateDay
                                  ? {
                                      borderColor: "#86efac",
                                      backgroundImage:
                                        "linear-gradient(135deg, rgba(134,239,172,0.5) 0%, rgba(255,255,255,0.94) 46%, rgba(220,252,231,0.92) 100%)",
                                    }
                                  : undefined
                              }
                            />
                              );
                            })()}
                          </div>
                        ))}
                        <div className="pointer-events-none absolute left-[5px] top-[5px] h-[calc(100%-10px)] w-[90px] rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent dark:border-primary/20 dark:from-primary/20 dark:via-primary/10 dark:to-transparent" />
                        {displayBookings.length ? (
                          displayBookings.map((displayBooking) => {
                            const tone =
                              bookingToneClasses[displayBooking.tone] || bookingToneClasses.blue;
                            const [bookingId, bookingStatus] = String(displayBooking.meta || "").split(" • ");
                            return (
                              <div
                                key={displayBooking.booking_id}
                                className="absolute inset-y-[5px] z-10 px-1"
                                style={{
                                  left: `${displayBooking.left_days * dayColumnWidth + 5}px`,
                                  width: `${(displayBooking.duration_days + 1) * dayColumnWidth - 10}px`,
                                }}
                              >
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onMouseDown={(event) => {
                                    if (savingBookingId) {
                                      return;
                                    }
                                    event.preventDefault();
                                    setCalendarError("");
                                    setCalendarSuccess("");
                                    setDragState({
                                      bookingId: displayBooking.booking_id,
                                      booking: displayBooking,
                                      startX: event.clientX,
                                      originalLeftDays: displayBooking.left_days,
                                      previewLeftDays: displayBooking.left_days,
                                      durationDays: displayBooking.duration_days,
                                      originalRoomId: group.room_id,
                                      originalRateId: rateRow.rate_id,
                                      targetRoomId: group.room_id,
                                      targetRateId: rateRow.rate_id,
                                      hasMoved: false,
                                    });
                                  }}
                                  onClick={() => {
                                    if (ignoreNextClickBookingId === displayBooking.booking_id) {
                                      return;
                                    }
                                    openBookingEditor(displayBooking, group);
                                  }}
                                  className={[
                                    "flex h-full cursor-grab flex-col justify-center overflow-hidden rounded-[18px] border-l-4 border-r-4 px-2.5 py-2 transition-all active:cursor-grabbing",
                                    "backdrop-blur-[2px] ring-1 ring-white/30",
                                    tone.card,
                                    savingBookingId === displayBooking.booking_id && "opacity-60",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p
                                      className={[
                                        "truncate text-[9px] font-black uppercase tracking-[0.12em]",
                                        tone.title,
                                      ].join(" ")}
                                    >
                                      {displayBooking.guest_name}
                                    </p>
                                    <span
                                      className={[
                                        "shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider",
                                        tone.badge,
                                      ].join(" ")}
                                    >
                                      {bookingStatus || "CONFIRMED"}
                                    </span>
                                  </div>
                                  <p
                                    className={[
                                      "mt-0.5 truncate text-[8px] font-semibold",
                                      tone.meta,
                                    ].join(" ")}
                                  >
                                    {bookingId || displayBooking.booking_id}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="absolute inset-y-0 left-0 flex items-center px-4 text-xs font-medium text-slate-400 dark:text-slate-500">
                            {rateRow.empty ? "No rate row in selected window" : "No booking for this rate"}
                          </div>
                        )}
                      </div>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        {calendarError ? (
          <div className="border-t border-rose-100 bg-rose-50 px-6 py-3 text-sm font-medium text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/30 lg:px-8">
            {calendarError}
          </div>
        ) : null}
        {calendarSuccess ? (
          <div className="border-t border-emerald-100 bg-emerald-50 px-6 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/30 lg:px-8">
            {calendarSuccess}
          </div>
        ) : null}
      </div>
      )}

      {selectedBooking ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  Booking Editor
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {selectedBooking.booking_id}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Review guest, stay, and payment details, then update reservation dates or status.
                </p>
              </div>
              <button
                type="button"
                onClick={closeBookingEditor}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveBookingEditor} className="mt-6 space-y-5">
              {loadingBookingDetails ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                  Loading booking details...
                </div>
              ) : null}

              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                      Basic Info
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Read-only reservation and payment details.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      ["Customer Name", selectedBooking.guest_name || "N/A"],
                      ["Room", [selectedBooking.room_name, selectedBooking.room_id].filter(Boolean).join(" • ") || "N/A"],
                      ["Stay Start", editForm.check_in_date || "N/A"],
                      ["Stay Nights", bookingNightCount ? `${bookingNightCount} night${bookingNightCount > 1 ? "s" : ""}` : "0 nights"],
                      ["Total Amount", formatCurrency(bookingTotalPrice, bookingCurrency)],
                      ["Paid Amount", formatCurrency(bookingPaidTotal, bookingCurrency)],
                      ["Due Amount", formatCurrency(bookingDueTotal, bookingCurrency)],
                      ["Created", bookingDetails?.created_at ? new Date(bookingDetails.created_at).toLocaleString("en-US") : "N/A"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/70">
                  <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                      Booking Change
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Update dates and reservation status.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Check-in Date
                      </span>
                      <input
                        type="date"
                        value={editForm.check_in_date}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            check_in_date: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Check-out Date
                      </span>
                      <input
                        type="date"
                        value={editForm.check_out_date}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            check_out_date: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      />
                    </label>
                  </div>

                  <label className="mt-4 block">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Booking Status
                    </span>
                    <select
                      value={editForm.booking_status}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          booking_status: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {["CONFIRMED", "CHECKED_IN", "PENDING"].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeBookingEditor}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || loadingBookingDetails}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingEdit ? "Saving..." : "Save & Close"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </PmsShell>
  );
}
