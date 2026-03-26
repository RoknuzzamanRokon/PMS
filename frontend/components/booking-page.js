"use client";

import { useEffect, useMemo, useState } from "react";
import { PmsShell } from "./pms-shell";
import { fetchJson } from "../lib/api";

const defaultPropertyId = "PROP001";

function toIsoDate(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function formatCurrency(value, currency = "USD") {
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

function getGuestName(guest) {
  if (!guest) {
    return "Unknown guest";
  }
  return [guest.first_name, guest.last_name].filter(Boolean).join(" ");
}

export function BookingPage({ propertyId }) {
  const initialCheckIn = useMemo(() => toIsoDate(new Date()), []);
  const initialCheckOut = useMemo(() => toIsoDate(addDays(new Date(), 1)), []);
  const [properties, setProperties] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [apiConnected, setApiConnected] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [reservationLoading, setReservationLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [reservationError, setReservationError] = useState("");
  const [reservationSuccess, setReservationSuccess] = useState("");
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedRateId, setSelectedRateId] = useState("");
  const [createdBooking, setCreatedBooking] = useState(null);
  const [form, setForm] = useState({
    property_id: propertyId || defaultPropertyId,
    guest_id: "",
    check_in_date: initialCheckIn,
    check_out_date: initialCheckOut,
    currency: "USD",
    booking_status: "Pending",
    occupant_name: "",
  });

  useEffect(() => {
    let ignore = false;

    async function loadLookups() {
      setLoadingLookups(true);

      try {
        const [propertyList, guestList] = await Promise.all([
          fetchJson("/properties"),
          fetchJson("/guests/all"),
        ]);

        if (ignore) {
          return;
        }

        const nextProperties = Array.isArray(propertyList) ? propertyList : [];
        const nextGuests = Array.isArray(guestList) ? guestList : [];
        const fallbackPropertyId = nextProperties[0]?.property_id || propertyId || defaultPropertyId;
        const fallbackGuest = nextGuests[0] || null;

        setProperties(nextProperties);
        setGuests(nextGuests);
        setForm((current) => ({
          ...current,
          property_id: current.property_id || fallbackPropertyId,
          guest_id: current.guest_id || fallbackGuest?.guest_id || "",
          occupant_name:
            current.occupant_name || (fallbackGuest ? getGuestName(fallbackGuest) : ""),
        }));
        setApiConnected(true);
      } catch {
        if (!ignore) {
          setApiConnected(false);
          setProperties([]);
          setGuests([]);
        }
      } finally {
        if (!ignore) {
          setLoadingLookups(false);
        }
      }
    }

    loadLookups();
    return () => {
      ignore = true;
    };
  }, [propertyId]);

  const selectedGuest = useMemo(
    () => guests.find((guest) => guest.guest_id === form.guest_id) || null,
    [form.guest_id, guests],
  );

  const selectedPlan = useMemo(
    () => availableRooms.find((plan) => plan.rate_id === selectedRateId) || null,
    [availableRooms, selectedRateId],
  );

  const estimatedTotal = useMemo(() => {
    if (!selectedPlan) {
      return null;
    }

    return Number(selectedPlan.total_price || 0);
  }, [selectedPlan]);

  function handleGuestChange(guestId) {
    const guest = guests.find((item) => item.guest_id === guestId) || null;
    setForm((current) => ({
      ...current,
      guest_id: guestId,
      occupant_name: guest ? getGuestName(guest) : current.occupant_name,
    }));
  }

  async function handleAvailabilitySearch(event) {
    event.preventDefault();
    setAvailabilityLoading(true);
    setAvailabilityError("");
    setReservationError("");
    setReservationSuccess("");
    setCreatedBooking(null);
    setAvailableRooms([]);
    setSelectedRateId("");

    try {
      const response = await fetchJson("/reservations/available-rooms", {
        method: "POST",
        body: JSON.stringify({
          property_id: form.property_id,
          guest_id: form.guest_id,
          check_in_date: form.check_in_date,
          check_out_date: form.check_out_date,
          currency: form.currency,
        }),
      });
      const plans = Array.isArray(response?.available_rooms)
        ? response.available_rooms
        : [];
      setAvailableRooms(plans);
      if (plans[0]?.rate_id) {
        setSelectedRateId(plans[0].rate_id);
      }
      setApiConnected(true);
    } catch (error) {
      setAvailabilityError(error.message || "Could not load available rooms.");
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function handleCreateReservation(event) {
    event.preventDefault();

    if (!selectedPlan) {
      setReservationError("Select an available room and rate before creating the booking.");
      return;
    }

    setReservationLoading(true);
    setReservationError("");
    setReservationSuccess("");

    try {
      const payload = {
        property_id: form.property_id,
        guest_id: form.guest_id,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date,
        currency: form.currency,
        booking_status: form.booking_status,
        rooms: [
          {
            room_id: selectedPlan.room_id,
            rate_id: selectedPlan.rate_id,
            occupant_name: form.occupant_name.trim(),
          },
        ],
      };

      const response = await fetchJson("/reservations", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setCreatedBooking(response);
      setReservationSuccess(`Reservation ${response.booking_id} created successfully.`);
    } catch (error) {
      setReservationError(error.message || "Could not create reservation.");
    } finally {
      setReservationLoading(false);
    }
  }

  return (
    <PmsShell
      searchPlaceholder="Search booking, guest, property..."
      sidebarMetricLabel="Available Plans"
      sidebarMetricValue={`${availableRooms.length}`}
      sidebarMetricProgress={Math.max(16, Math.min(100, availableRooms.length * 20))}
    >
      <div className="space-y-8">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <span className="material-symbols-outlined text-base">event_available</span>
              Booking Workspace
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Create Reservation</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              Search room availability, choose a guest, and create a live booking through
              `/api/v1/reservations`.
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
            {apiConnected ? "Booking API Live" : "Waiting For API"}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            onSubmit={handleAvailabilitySearch}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
          >
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">Search Availability</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Choose travel dates and booking details first.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {loadingLookups ? "Loading data..." : `${properties.length} properties`}
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Property</span>
                <select
                  value={form.property_id}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, property_id: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                >
                  {properties.map((property) => (
                    <option key={property.property_id} value={property.property_id}>
                      {property.property_id} - {property.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Guest</span>
                <select
                  value={form.guest_id}
                  onChange={(event) => handleGuestChange(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                >
                  {guests.map((guest) => (
                    <option key={guest.guest_id} value={guest.guest_id}>
                      {guest.guest_id} - {getGuestName(guest)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Check-In</span>
                <input
                  type="date"
                  value={form.check_in_date}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, check_in_date: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Check-Out</span>
                <input
                  type="date"
                  value={form.check_out_date}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, check_out_date: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Currency</span>
                <input
                  type="text"
                  value={form.currency}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                />
              </label>
            </div>

            {availabilityError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {availabilityError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={availabilityLoading || loadingLookups}
                className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {availabilityLoading ? "Searching..." : "Search Available Rooms"}
              </button>
            </div>
          </form>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <h3 className="text-lg font-bold">Booking Snapshot</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Review the current guest and selected room plan before submit.
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Guest
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {selectedGuest ? getGuestName(selectedGuest) : "No guest selected"}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedGuest ? `${selectedGuest.guest_id} • ${selectedGuest.email}` : "Select a guest to continue"}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Selected Plan
                </p>
                <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                  {selectedPlan ? selectedPlan.rate_title : "No room selected"}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedPlan
                    ? `${selectedPlan.room_id} • ${selectedPlan.rate_id} • ${selectedPlan.total_nights} nights`
                    : "Search availability to see matching room options"}
                </p>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Estimated Total
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {estimatedTotal == null
                    ? "--"
                    : formatCurrency(estimatedTotal, selectedPlan?.currency || form.currency)}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Based on the selected room total for this stay.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold">Available Rooms</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Pick one available room-rate combination to send in the `rooms` array.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {availableRooms.length} options
            </span>
          </div>

          {availableRooms.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {availableRooms.map((plan) => {
                const active = selectedRateId === plan.rate_id;
                return (
                  <button
                    key={plan.rate_id}
                    type="button"
                    onClick={() => setSelectedRateId(plan.rate_id)}
                    className={[
                      "rounded-3xl border p-5 text-left transition",
                      active
                        ? "border-primary bg-primary/[0.05] ring-2 ring-primary/15"
                        : "border-slate-200 hover:border-primary/40 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/70",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {plan.room_name}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {plan.room_id} • {plan.rate_id} • {plan.rate_title}
                        </p>
                      </div>
                      <span
                        className={[
                          "rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider",
                          active
                            ? "bg-primary text-white"
                            : "bg-emerald-100 text-emerald-700",
                        ].join(" ")}
                      >
                        {active ? "Selected" : "Available"}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                          Base Rate
                        </p>
                        <p className="mt-2 text-base font-semibold">
                          {formatCurrency(plan.base_rate, plan.currency)}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                          Nights
                        </p>
                        <p className="mt-2 text-base font-semibold">{plan.total_nights}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                          Total Price
                        </p>
                        <p className="mt-2 text-base font-semibold">
                          {formatCurrency(plan.total_price, plan.currency)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-12 text-center dark:border-slate-700">
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                No availability loaded yet
              </p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Run the availability search above to load rooms that can be booked.
              </p>
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <form
            onSubmit={handleCreateReservation}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
          >
            <h3 className="text-lg font-bold">Create Booking</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              This sends a `POST` request to `/api/v1/reservations`.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Guest</span>
                <select
                  value={form.guest_id}
                  onChange={(event) => handleGuestChange(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                >
                  {guests.map((guest) => (
                    <option key={guest.guest_id} value={guest.guest_id}>
                      {guest.guest_id} - {getGuestName(guest)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Booking Status
                </span>
                <select
                  value={form.booking_status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, booking_status: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
                >
                  <option value="Pending">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
            </div>

            <label className="mt-4 block space-y-2 text-sm">
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Occupant Name
              </span>
              <input
                type="text"
                value={form.occupant_name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, occupant_name: event.target.value }))
                }
                placeholder="Guest name staying in the room"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100"
              />
            </label>

            <div className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-800/70">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">Property ID</span>
                <span className="font-semibold">{form.property_id || "--"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">Guest ID</span>
                <span className="font-semibold">{form.guest_id || "--"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">Room ID</span>
                <span className="font-semibold">{selectedPlan?.room_id || "--"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">Rate ID</span>
                <span className="font-semibold">{selectedPlan?.rate_id || "--"}</span>
              </div>
            </div>

            {reservationError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {reservationError}
              </div>
            ) : null}

            {reservationSuccess ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {reservationSuccess}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={reservationLoading || !selectedPlan || !form.guest_id || !form.occupant_name.trim()}
              className="mt-6 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900"
            >
              {reservationLoading ? "Creating Booking..." : "Create Booking"}
            </button>
          </form>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <h3 className="text-lg font-bold">API Response</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              The reservation result is shown here after a successful booking.
            </p>

            {createdBooking ? (
              <div className="mt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ["Booking ID", createdBooking.booking_id],
                    ["Property ID", createdBooking.property_id],
                    ["Guest ID", createdBooking.guest_id],
                    ["Status", createdBooking.booking_status],
                    ["Check-In", createdBooking.check_in_date],
                    ["Check-Out", createdBooking.check_out_date],
                    ["Currency", createdBooking.currency],
                    [
                      "Total Price",
                      formatCurrency(createdBooking.total_price, createdBooking.currency),
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                        {label}
                      </p>
                      <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Price Breakdown
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Base Price", createdBooking.price?.base_price],
                      ["Tax Price", createdBooking.price?.tax_price],
                      ["Per Night Price", createdBooking.price?.per_night_price],
                      ["Total Price", createdBooking.price?.total_price],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                          {label}
                        </p>
                        <p className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(value, createdBooking.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <pre className="custom-scrollbar overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                  {JSON.stringify(createdBooking, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-dashed border-slate-200 px-6 py-12 text-center dark:border-slate-700">
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Booking response will appear here
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Create a reservation to inspect the returned booking ID, totals, and price object.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </PmsShell>
  );
}
