import { RoomsManagementPage } from "../../components/rooms-page";

export default async function RoomsRoute({ searchParams }) {
  const params = await searchParams;

  return <RoomsManagementPage propertyId={params?.property_id} />;
}
