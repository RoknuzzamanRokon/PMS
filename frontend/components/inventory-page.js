"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PmsShell } from "./pms-shell";
import { fetchJson } from "../lib/api";

const defaultPropertyId = "PROP001";
const dayColumnWidth = 100;

const bookingToneClasses = {
  blue: {
    dot: "bg-blue-500",
    card: "border-blue-500 bg-blue-500/15 hover:bg-blue-500/25",
    title: "text-blue-700",
    meta: "text-blue-600",
    badge: "bg-blue-500 text-white",
  },
  green: {
    dot: "bg-green-500",
    card: "border-green-500 bg-green-500/15 hover:bg-green-500/25",
    title: "text-green-700",
    meta: "text-green-600",
    badge: "bg-green-500 text-white",
  },
  amber: {
    dot: "bg-amber-400",
    card: "border-amber-400 bg-amber-400/20 hover:bg-amber-400/30",
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

const fallbackCalendar = {
  property: { property_id: defaultPropertyId, name: "Selected Property" },
  start_date: new Date().toISOString().slice(0, 10),
  days: 14,
  rows: [],
};

export function InventoryPage({ propertyId }) {
  const selectedPropertyId = propertyId || defaultPropertyId;
  const [calendar, setCalendar] = useState(fallbackCalendar);
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

  async function loadCalendar() {
    try {
      const data = await fetchJson(
        `/inventory/calendar?property_id=${encodeURIComponent(selectedPropertyId)}&days=14`,
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
      try {
        const data = await fetchJson(
          `/inventory/calendar?property_id=${encodeURIComponent(selectedPropertyId)}&days=14`,
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
  }, [selectedPropertyId]);

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
        return {
          ...current,
          hasMoved: current.hasMoved || deltaDays !== 0,
          previewLeftDays: clampLeftDays(current.originalLeftDays + deltaDays, current.durationDays),
        };
      });
    }

    async function handlePointerUp() {
      const currentDrag = dragState;
      setDragState(null);

      if (!currentDrag || currentDrag.previewLeftDays === currentDrag.originalLeftDays) {
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
        await fetchJson(`/reservations/${encodeURIComponent(currentDrag.bookingId)}`, {
          method: "PATCH",
          body: JSON.stringify({
            check_in_date: nextCheckInDate,
            check_out_date: nextCheckOutDate,
          }),
        });
        await loadCalendar();
        setCalendarSuccess(
          `Updated ${currentDrag.bookingId} to ${nextCheckInDate} - ${nextCheckOutDate}.`,
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

  function openBookingEditor(booking) {
    if (!booking) {
      return;
    }
    setSelectedBooking(booking);
    setEditForm({
      check_in_date: booking.check_in_date,
      check_out_date: booking.check_out_date,
      booking_status: booking.booking_status || "CONFIRMED",
    });
    setCalendarError("");
    setCalendarSuccess("");
  }

  function closeBookingEditor() {
    setSelectedBooking(null);
    setSavingEdit(false);
  }

  async function handleSaveBookingEditor(event) {
    event.preventDefault();
    if (!selectedBooking?.booking_id) {
      return;
    }

    setSavingEdit(true);
    setCalendarError("");
    setCalendarSuccess("");

    try {
      await fetchJson(`/reservations/${encodeURIComponent(selectedBooking.booking_id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          check_in_date: editForm.check_in_date,
          check_out_date: editForm.check_out_date,
          booking_status: editForm.booking_status,
        }),
      });
      await loadCalendar();
      setCalendarSuccess(`Updated ${selectedBooking.booking_id} successfully.`);
      closeBookingEditor();
    } catch (error) {
      setCalendarError(error.message || `Could not update ${selectedBooking.booking_id}.`);
      setSavingEdit(false);
    }
  }

  return (
    <PmsShell
      searchPlaceholder="Search rooms or guests..."
      sidebarMetricLabel="Calendar Rows"
      sidebarMetricValue={`${calendar.rows.length}`}
      sidebarMetricProgress={Math.max(20, Math.min(100, calendar.rows.length * 18))}
    >
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
              ["hotel", "Rows:", `${calendar.rows.length}`],
              ["link", "Endpoint:", `/inventory/calendar?property_id=${selectedPropertyId}&days=14`],
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

        {calendarError ? (
          <div className="border-b border-rose-100 bg-rose-50 px-6 py-3 text-sm font-medium text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/30 lg:px-8">
            {calendarError}
          </div>
        ) : null}
        {calendarSuccess ? (
          <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/30 lg:px-8">
            {calendarSuccess}
          </div>
        ) : null}

        <div className="custom-scrollbar flex-1 overflow-auto bg-slate-50 dark:bg-slate-950/40">
          <div className="min-w-max">
            <div className="calendar-grid sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/95">
              <div className="flex items-center justify-between border-r border-slate-200 p-4 dark:border-slate-700">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Rooms
                </span>
                <span className="material-symbols-outlined text-sm text-slate-400">
                  unfold_more
                </span>
              </div>
              {days.map((day) => (
                <div
                  key={`${day.label}-${day.date}`}
                  className={[
                    "flex flex-col items-center justify-center border-r border-slate-200 p-2 dark:border-slate-700",
                    day.today && "bg-slate-50 dark:bg-slate-800/80",
                    day.weekend && "bg-slate-100/60 dark:bg-slate-800/40",
                  ]
                    .filter(Boolean)
                    .join(" ")}
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
              ))}
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {calendar.rows.map((row) => (
                <div key={row.room_id} className="calendar-grid h-16">
                  <div className="flex flex-col justify-center border-r border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/80">
                    <span className="text-sm font-bold leading-none">{row.room_id}</span>
                    <span className="mt-1 text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">
                      {row.room_name}
                    </span>
                  </div>
                  <div className="relative col-span-14 grid h-full grid-cols-14 border-r border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900/70">
                    <div className="pointer-events-none absolute left-[0px] top-0 h-full w-[100px] border-x border-primary/10 bg-primary/5 dark:border-primary/20 dark:bg-primary/10" />
                    {row.booking ? (
                      <div
                        className="absolute top-2 z-10 h-12 px-1"
                        style={{
                          left: `${
                            (dragState?.bookingId === row.booking.booking_id
                              ? dragState.previewLeftDays
                              : row.booking.left_days) * dayColumnWidth
                          }px`,
                          width: `${row.booking.duration_days * dayColumnWidth}px`,
                        }}
                      >
                        {(() => {
                          const tone =
                            bookingToneClasses[row.booking.tone] || bookingToneClasses.blue;
                          const [bookingId, bookingStatus] = String(row.booking.meta || "")
                            .split(" • ");
                          return (
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
                              bookingId: row.booking.booking_id,
                              startX: event.clientX,
                              originalLeftDays: row.booking.left_days,
                              previewLeftDays: row.booking.left_days,
                              durationDays: row.booking.duration_days,
                              hasMoved: false,
                            });
                          }}
                          onClick={() => {
                            if (ignoreNextClickBookingId === row.booking.booking_id) {
                              return;
                            }
                            openBookingEditor(row.booking);
                          }}
                          className={[
                            "flex h-full cursor-grab flex-col justify-center overflow-hidden rounded-lg border-l-4 p-2 transition-all active:cursor-grabbing",
                            tone.card,
                            savingBookingId === row.booking.booking_id && "opacity-60",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className={["truncate text-[10px] font-black uppercase", tone.title].join(" ")}>
                              {row.booking.guest_name}
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
                          <p className={["truncate text-[9px]", tone.meta].join(" ")}>
                            {bookingId || row.booking.booking_id}
                          </p>
                        </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="absolute inset-y-0 left-0 flex items-center px-4 text-xs font-medium text-slate-400 dark:text-slate-500">
                        No booking in selected window
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

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
                  Update stay dates or reservation status.
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

            <form onSubmit={handleSaveBookingEditor} className="mt-6 space-y-4">
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

              <label className="block">
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
                  disabled={savingEdit}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </PmsShell>
  );
}
