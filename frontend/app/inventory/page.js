import { InventoryPage } from "../../components/inventory-page";

export default async function InventoryRoute({ searchParams }) {
  const params = await searchParams;

  return <InventoryPage propertyId={params?.property_id} />;
}
