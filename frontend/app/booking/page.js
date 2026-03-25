import { BookingPage } from "../../components/booking-page";

export default async function BookingRoute({ searchParams }) {
  const params = await searchParams;

  return <BookingPage propertyId={params?.property_id} />;
}
