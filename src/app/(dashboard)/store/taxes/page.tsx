import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStoreProfile } from "@/lib/store";
import TaxesClient from "./taxes-client";

export const dynamic = "force-dynamic";

export default async function StoreTaxesPage() {
  const user = (await getCurrentUser())!;
  const profile = await getStoreProfile(user.id);
  const rates = await db.taxRate.findMany({ where: { userId: user.id }, orderBy: [{ country: "asc" }, { region: "asc" }] });
  return (
    <TaxesClient
      settings={{
        taxEnabled: profile.taxEnabled,
        taxMode: profile.taxMode,
        taxRate: profile.taxRate,
        taxNexus: profile.taxNexus,
        taxShipping: profile.taxShipping,
      }}
      rates={rates.map((r) => ({ id: r.id, name: r.name, country: r.country, region: r.region, ratePct: r.ratePct, active: r.active }))}
    />
  );
}
