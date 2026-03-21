import { DailyRatesPage } from "../../components/rates-page";

export default async function DailyRatesRoute({ searchParams }) {
  const params = await searchParams;

  return <DailyRatesPage propertyId={params?.property_id} />;
}
