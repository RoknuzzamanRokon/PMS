"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PmsShell } from "./pms-shell";
import { fetchJson } from "../lib/api";

const dayColumnWidth = 100;
const inventoryViewOptions = [7, 15, 30];

const bookingToneClasses = {
  slate: {
    dot: "bg-slate-500",
    card: "border-slate-400/40 bg-slate-500/12 shadow-[0_10px_24px_-18px_rgba(100,116,139,0.45)]",
    title: "text-slate-900 dark:text-slate-100",
    meta: "text-slate-700 dark:text-slate-300",
    badge: "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900",
  },
  stone: {
    dot: "bg-stone-500",
    card: "border-stone-400/40 bg-stone-500/12 shadow-[0_10px_24px_-18px_rgba(120,113,108,0.40)]",
    title: "text-stone-900 dark:text-stone-100",
    meta: "text-stone-700 dark:text-stone-300",
    badge: "bg-stone-700 text-white dark:bg-stone-200 dark:text-stone-900",
  },
  zinc: {
    dot: "bg-zinc-500",
    card: "border-zinc-400/40 bg-zinc-500/12 shadow-[0_10px_24px_-18px_rgba(113,113,122,0.40)]",
    title: "text-zinc-900 dark:text-zinc-100",
    meta: "text-zinc-700 dark:text-zinc-300",
    badge: "bg-zinc-700 text-white dark:bg-zinc-200 dark:text-zinc-900",
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
      date: current.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
      }),
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

function getRoomDateAvailabilityKeys(rateDateKeys) {
  const nextKeys = new Set();

  for (const key of rateDateKeys) {
    const [roomId, , date] = String(key).split("::");
    if (roomId && date) {
      nextKeys.add(`${roomId}::${date}`);
    }
  }

  return nextKeys;
}

function buildStackedBookings(bookings) {
  const sortedBookings = [...bookings].sort((left, right) => {
    if (left.left_days !== right.left_days) {
      return left.left_days - right.left_days;
    }
    if (left.duration_days !== right.duration_days) {
      return right.duration_days - left.duration_days;
    }

    return String(left.booking_id).localeCompare(String(right.booking_id));
  });
  const laneEndDays = [];

  return sortedBookings.map((booking) => {
    const startDay = Number(booking.left_days || 0);
    const endDay = startDay + Number(booking.duration_days || 0);
    let laneIndex = laneEndDays.findIndex(
      (laneEndDay) => startDay > laneEndDay,
    );

    if (laneIndex === -1) {
      laneIndex = laneEndDays.length;
      laneEndDays.push(endDay);
    } else {
      laneEndDays[laneIndex] = endDay;
    }

    return {
      ...booking,
      laneIndex,
    };
  });
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

        const nextRateDateKeys = new Set();
        for (const item of data.availability || []) {
          if (!item?.date) {
            continue;
          }
          for (const room of item.rooms || []) {
            for (const rate of room.rates || []) {
              if (room.room_id && rate.rate_id) {
                nextRateDateKeys.add(
                  `${room.room_id}::${rate.rate_id}::${item.date}`,
                );
              }
            }
          }
        }

        setAvailableRateDateKeys(nextRateDateKeys);
      } catch {
        if (!ignore) {
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
      return Math.max(
        0,
        Math.min(leftDays, Math.max(calendar.days - durationDays, 0)),
      );
    }

    function handlePointerMove(event) {
      setDragState((current) => {
        if (!current) {
          return current;
        }

        const deltaDays = Math.round(
          (event.clientX - current.startX) / dayColumnWidth,
        );
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
          previewLeftDays: clampLeftDays(
            current.originalLeftDays + deltaDays,
            current.durationDays,
          ),
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
        (currentDrag.previewLeftDays === currentDrag.originalLeftDays &&
          currentDrag.targetRoomId === currentDrag.originalRoomId &&
          currentDrag.targetRateId === currentDrag.originalRateId)
      ) {
        return;
      }

      if (currentDrag.hasMoved) {
        setIgnoreNextClickBookingId(currentDrag.bookingId);
        window.setTimeout(() => setIgnoreNextClickBookingId(""), 150);
      }

      const nextCheckInDate = addDaysToIsoDate(
        calendar.start_date,
        currentDrag.previewLeftDays,
      );
      const nextCheckOutDate = addDaysToIsoDate(
        nextCheckInDate,
        currentDrag.durationDays,
      );

      if (!currentDrag.targetRateId) {
        setCalendarError(
          `Could not move ${currentDrag.bookingId}. The destination room has no linked rate plan.`,
        );
        setCalendarSuccess("");
        return;
      }

      setSavingBookingId(currentDrag.bookingId);
      setCalendarError("");
      setCalendarSuccess("");

      try {
        const updatedReservation = await fetchJson(
          `/reservations/${encodeURIComponent(currentDrag.bookingId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              check_in_date: nextCheckInDate,
              check_out_date: nextCheckOutDate,
              room_id: currentDrag.targetRoomId,
              rate_id: currentDrag.targetRateId,
            }),
          },
        );
        await loadCalendar();
        setCalendarSuccess(
          `Updated ${updatedReservation.booking_id || currentDrag.bookingId} to ${updatedReservation.check_in_date || nextCheckInDate} - ${updatedReservation.check_out_date || nextCheckOutDate} on ${currentDrag.targetRoomId}/${currentDrag.targetRateId}.`,
        );
      } catch (error) {
        await loadCalendar();
        setCalendarError(
          error.message || `Could not update ${currentDrag.bookingId}.`,
        );
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
  const roomAvailableDateKeys = useMemo(
    () => getRoomDateAvailabilityKeys(availableRateDateKeys),
    [availableRateDateKeys],
  );
  const roomRows = useMemo(() => {
    const groups = new Map();

    for (const row of calendar.rows) {
      if (!row?.room_id) {
        continue;
      }

      if (!groups.has(row.room_id)) {
        groups.set(row.room_id, {
          room_id: row.room_id,
          room_name: row.room_name,
          rates: row.rates || [],
          rateTitleById: new Map(),
          bookings: [],
        });
      }

      const group = groups.get(row.room_id);
      for (const rate of row.rates || []) {
        if (rate?.rate_id) {
          group.rateTitleById.set(rate.rate_id, rate.title || rate.rate_id);
        }
      }

      if (row.booking?.booking_id) {
        const bookingRateId = row.booking.rate_id || "";
        group.bookings.push({
          ...row.booking,
          room_id: row.room_id,
          room_name: row.room_name,
          rate_id: bookingRateId,
          rate_title:
            group.rateTitleById.get(bookingRateId) ||
            (row.rates || []).find((rate) => rate.rate_id === bookingRateId)
              ?.title ||
            bookingRateId ||
            "Unassigned",
        });
      }
    }

    return Array.from(groups.values())
      .map((group) => {
        const stackedBookings = buildStackedBookings(group.bookings);
        const laneCount = stackedBookings.length
          ? Math.max(...stackedBookings.map((booking) => booking.laneIndex)) + 1
          : 1;

        return {
          ...group,
          defaultRateId: group.rates?.[0]?.rate_id || "",
          stackedBookings,
          laneCount,
          rowHeight: Math.max(56, laneCount * 28 + 16),
        };
      })
      .sort((left, right) =>
        String(left.room_name || left.room_id).localeCompare(
          String(right.room_name || right.room_id),
        ),
      );
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
        fetchJson(
          `/reservations/${encodeURIComponent(booking.booking_id)}/payments`,
        ).catch(() => []),
      ]);
      setBookingDetails(reservation);
      setBookingPayments(Array.isArray(payments) ? payments : []);
    } catch (error) {
      setCalendarError(
        error.message || `Could not load ${booking.booking_id} details.`,
      );
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
    () =>
      bookingPayments.reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0,
      ),
    [bookingPayments],
  );
  const bookingTotalPrice = Number(bookingDetails?.total_price || 0);
  const bookingCurrency = bookingDetails?.currency || "USD";
  const bookingDueTotal = Math.max(bookingTotalPrice - bookingPaidTotal, 0);
  const bookingNightCount = getNightCount(
    editForm.check_in_date,
    editForm.check_out_date,
  );

  return (
    <PmsShell
      searchPlaceholder="Search rooms or guests..."
      sidebarMetricLabel="Calendar Rows"
      sidebarMetricValue={`${roomRows.length}`}
      sidebarMetricProgress={Math.max(20, Math.min(100, roomRows.length * 18))}
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
            Open inventory with a `property_id` to view the booking calendar for
            a property.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/properties"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition-opacity hover:opacity-90 dark:bg-slate-100 dark:text-slate-900"
            >
              <span className="material-symbols-outlined text-base">
                arrow_back
              </span>
              Go to Properties
            </Link>
          </div>
        </section>
      ) : (
        <div className="-m-6 flex min-h-[calc(100vh-108px)] flex-col overflow-hidden lg:-m-8">
          <div className="border-b border-slate-200 bg-white px-6 py-6 dark:border-slate-700 dark:bg-slate-950 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Inventory Calendar
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Real bookings by room from `/api/v1/inventory/calendar` for{" "}
                  {calendar.property.name}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/properties"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-500 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
                  >
                    <span className="material-symbols-outlined text-base">
                      arrow_back
                    </span>
                    Back to Properties
                  </Link>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <span className="material-symbols-outlined text-base">
                      pin_drop
                    </span>
                    Viewing {calendar.property.name}
                  </div>
                  <div className="inline-flex overflow-hidden rounded-xl border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                    {inventoryViewOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSelectedDays(option)}
                        className={[
                          "px-3 py-2 text-sm font-bold transition-colors",
                          selectedDays === option
                            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                            : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
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
                    ? "border border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    : "border border-stone-300 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-900/40 dark:text-stone-200",
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
                ["hotel", "Rows:", `${roomRows.length}`],
                [
                  "link",
                  "Endpoint:",
                  `/inventory/calendar?property_id=${selectedPropertyId}&days=${selectedDays}`,
                ],
              ].map(([icon, label, value]) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                >
                  <span className="material-symbols-outlined text-lg text-slate-400">
                    {icon}
                  </span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {label}
                  </span>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {value}
                  </span>
                </div>
              ))}
              <div className="ml-auto flex items-center gap-6">
                {[
                  ["slate", "Confirmed"],
                  ["stone", "Checked-in"],
                  ["zinc", "Pending"],
                ].map(([tone, label]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span
                      className={`size-2.5 rounded-full ${bookingToneClasses[tone].dot}`}
                    />
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="custom-scrollbar flex-1 overflow-auto bg-slate-50 px-6 py-6 dark:bg-slate-950 lg:px-8">
            <div className="min-w-max overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-925">
              <div
                className="sticky top-0 z-30 grid"
                style={{
                  backgroundColor: "rgba(248, 250, 252, 0.96)",
                  gridTemplateColumns: `200px repeat(${calendar.days}, minmax(${dayColumnWidth}px, 1fr))`,
                }}
              >
                <div
                  className="sticky left-0 z-20 flex min-h-[72px] items-center p-4 text-left shadow-[2px_0_10px_rgba(15,23,42,0.08)] dark:shadow-[2px_0_10px_rgba(0,0,0,0.24)]"
                  style={{
                    borderRight: "1px solid rgba(148, 163, 184, 0.18)",
                    backgroundColor: "rgba(248, 250, 252, 0.98)",
                  }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Room Category
                  </span>
                </div>
                {days.map((day) => (
                  <div
                    key={day.isoDate}
                    className="min-w-[48px] p-3 text-center"
                    style={{
                      borderRight: "1px solid rgba(148, 163, 184, 0.12)",
                      backgroundColor: day.weekend
                        ? "rgba(241, 245, 249, 0.92)"
                        : "transparent",
                    }}
                  >
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        {day.today ? "Today" : day.label}
                      </span>
                      <span
                        className="text-lg font-bold"
                        style={{
                          color: day.today ? "rgb(15 23 42)" : "rgb(51 65 85)",
                        }}
                      >
                        {day.date.slice(0, 2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {roomRows.map((room, rowIndex) => {
                const isDropTargetRoom =
                  dragState && dragState.targetRoomId === room.room_id;
                const displayBookings = room.stackedBookings
                  .filter((booking) => {
                    if (
                      !dragState ||
                      dragState.bookingId !== booking.booking_id
                    ) {
                      return true;
                    }

                    return dragState.targetRoomId === room.room_id;
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
                  isDropTargetRoom &&
                  dragState?.booking &&
                  !displayBookings.some(
                    (booking) => booking.booking_id === dragState.bookingId,
                  )
                ) {
                  displayBookings.push({
                    ...dragState.booking,
                    room_id: dragState.targetRoomId,
                    rate_id: dragState.targetRateId,
                    left_days: dragState.previewLeftDays,
                  });
                }

                const stackedDisplayBookings =
                  buildStackedBookings(displayBookings);
                const activeLaneCount = stackedDisplayBookings.length
                  ? Math.max(
                      ...stackedDisplayBookings.map(
                        (booking) => booking.laneIndex,
                      ),
                    ) + 1
                  : 1;
                const rowHeight = Math.max(
                  room.rowHeight,
                  activeLaneCount * 28 + 16,
                );

                return (
                  <div
                    key={room.room_id}
                    className="group grid transition-colors"
                    style={{
                      gridTemplateColumns: `200px repeat(${calendar.days}, minmax(${dayColumnWidth}px, 1fr))`,
                    }}
                  >
                    <div
                      className="sticky left-0 z-10 flex flex-col justify-center px-4 py-4 shadow-[2px_0_10px_rgba(15,23,42,0.06)] transition-colors dark:shadow-[2px_0_10px_rgba(0,0,0,0.20)]"
                      style={{
                        minHeight: `${rowHeight}px`,
                        borderRight: "1px solid rgba(148, 163, 184, 0.18)",
                        backgroundColor:
                          rowIndex % 2 === 0
                            ? "rgba(255,255,255,0.96)"
                            : "rgba(248,250,252,0.96)",
                      }}
                    >
                      <span className="font-headline font-semibold text-slate-800 dark:text-slate-100">
                        {room.room_name || room.room_id}
                      </span>
                      <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        {room.room_id}
                      </span>
                    </div>

                    <div
                      className="relative"
                      data-booking-drop-target="true"
                      data-room-id={room.room_id}
                      data-rate-id={room.defaultRateId || ""}
                      onMouseEnter={() => {
                        if (!dragState) {
                          return;
                        }

                        setDragState((current) =>
                          current
                            ? {
                                ...current,
                                targetRoomId: room.room_id,
                                targetRateId:
                                  current.originalRoomId === room.room_id
                                    ? current.originalRateId
                                    : room.defaultRateId || "",
                                hasMoved:
                                  current.hasMoved ||
                                  room.room_id !== current.originalRoomId,
                              }
                            : current,
                        );
                      }}
                      style={{
                        gridColumn: "2 / -1",
                        minHeight: `${rowHeight}px`,
                      }}
                    >
                      <div
                        className="grid"
                        style={{
                          gridTemplateColumns: `repeat(${calendar.days}, minmax(${dayColumnWidth}px, 1fr))`,
                          minHeight: `${rowHeight}px`,
                        }}
                      >
                        {days.map((day) => {
                          const isAvailableRoomDay = roomAvailableDateKeys.has(
                            `${room.room_id}::${day.isoDate}`,
                          );
                          const neutralCell =
                            rowIndex % 2 === 0
                              ? "rgba(255,255,255,0.92)"
                              : "rgba(248,250,252,0.92)";
                          const weekendCell =
                            rowIndex % 2 === 0
                              ? "rgba(248,250,252,0.96)"
                              : "rgba(241,245,249,0.96)";

                          return (
                            <div
                              key={`${room.room_id}-${day.isoDate}`}
                              className="p-1"
                              style={{
                                borderRight:
                                  "1px solid rgba(148, 163, 184, 0.12)",
                              }}
                            >
                              <div
                                className="flex h-full w-full items-center justify-center rounded-sm border transition-all hover:scale-[1.01] hover:shadow-sm"
                                style={{
                                  minHeight: `${rowHeight - 8}px`,
                                  borderColor: isAvailableRoomDay
                                    ? "rgba(100, 116, 139, 0.28)"
                                    : "rgba(148, 163, 184, 0.18)",
                                  backgroundColor: isAvailableRoomDay
                                    ? "rgba(226, 232, 240, 0.75)"
                                    : day.weekend
                                      ? weekendCell
                                      : neutralCell,
                                  opacity: 1,
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {stackedDisplayBookings.map((displayBooking) => {
                        const tone =
                          bookingToneClasses[displayBooking.tone] ||
                          bookingToneClasses.slate;
                        const [bookingId, bookingStatus] = String(
                          displayBooking.meta || "",
                        ).split(" • ");

                        return (
                          <div
                            key={displayBooking.booking_id}
                            className="absolute z-10 px-1"
                            style={{
                              left: `${displayBooking.left_days * dayColumnWidth + 4}px`,
                              top: `${displayBooking.laneIndex * 28 + 6}px`,
                              width: `${(displayBooking.duration_days + 1) * dayColumnWidth - 8}px`,
                              height: "24px",
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
                                  originalRoomId: room.room_id,
                                  originalRateId:
                                    displayBooking.rate_id ||
                                    room.defaultRateId ||
                                    "",
                                  targetRoomId: room.room_id,
                                  targetRateId:
                                    displayBooking.rate_id ||
                                    room.defaultRateId ||
                                    "",
                                  hasMoved: false,
                                });
                              }}
                              onClick={() => {
                                if (
                                  ignoreNextClickBookingId ===
                                  displayBooking.booking_id
                                ) {
                                  return;
                                }
                                openBookingEditor(displayBooking, room);
                              }}
                              className={[
                                "flex h-full cursor-grab items-center gap-2 overflow-hidden rounded-sm border px-2 transition-all hover:scale-[1.01] active:cursor-grabbing",
                                tone.card,
                                savingBookingId === displayBooking.booking_id &&
                                  "opacity-60",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <span
                                className={[
                                  "truncate text-[9px] font-black uppercase tracking-[0.12em]",
                                  tone.title,
                                ].join(" ")}
                              >
                                {displayBooking.guest_name}
                              </span>
                              <span className="truncate font-mono text-[8px] text-slate-500 dark:text-slate-400">
                                {displayBooking.rate_title ||
                                  displayBooking.rate_id ||
                                  "Rate"}
                              </span>
                              <span
                                className={[
                                  "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider",
                                  tone.badge,
                                ].join(" ")}
                              >
                                {bookingStatus || "CONFIRMED"}
                              </span>
                              <span
                                className={[
                                  "shrink-0 text-[8px] font-semibold",
                                  tone.meta,
                                ].join(" ")}
                              >
                                {bookingId || displayBooking.booking_id}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className="mt-8 flex flex-wrap items-center justify-between gap-6">
              <div
                className="flex items-center gap-6 rounded-full px-6 py-3"
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.18)",
                  backgroundColor: "rgba(255,255,255,0.88)",
                }}
              >
                {[
                  ["bg-slate-300", "Available"],
                  ["bg-slate-600", "Booked"],
                  ["bg-stone-500", "Pending"],
                  ["bg-zinc-700", "Priority"],
                ].map(([swatchClass, label]) => (
                  <div key={label} className="flex items-center gap-2">
                    <div
                      className={["h-3 w-3 rounded-full", swatchClass].join(
                        " ",
                      )}
                    />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
                <span className="font-mono text-[10px] uppercase tracking-widest">
                  Neutral Ledger
                </span>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-slate-700 dark:text-slate-200">
                  Inventory Grid
                </span>
              </div>
            </footer>
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
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">
                  Booking Editor
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {selectedBooking.booking_id}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Review guest, stay, and payment details, then update
                  reservation dates or status.
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
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">
                      Basic Info
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Read-only reservation and payment details.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      ["Customer Name", selectedBooking.guest_name || "N/A"],
                      [
                        "Room",
                        [selectedBooking.room_name, selectedBooking.room_id]
                          .filter(Boolean)
                          .join(" • ") || "N/A",
                      ],
                      ["Stay Start", editForm.check_in_date || "N/A"],
                      [
                        "Stay Nights",
                        bookingNightCount
                          ? `${bookingNightCount} night${bookingNightCount > 1 ? "s" : ""}`
                          : "0 nights",
                      ],
                      [
                        "Total Amount",
                        formatCurrency(bookingTotalPrice, bookingCurrency),
                      ],
                      [
                        "Paid Amount",
                        formatCurrency(bookingPaidTotal, bookingCurrency),
                      ],
                      [
                        "Due Amount",
                        formatCurrency(bookingDueTotal, bookingCurrency),
                      ],
                      [
                        "Created",
                        bookingDetails?.created_at
                          ? new Date(bookingDetails.created_at).toLocaleString(
                              "en-US",
                            )
                          : "N/A",
                      ],
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
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">
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
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
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
