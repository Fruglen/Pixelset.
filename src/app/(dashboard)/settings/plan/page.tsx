import Link from "next/link";
import { ADD_ON_PRICES, PRICING } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/auth";
import { GALLERY_TIERS, STUDIO_TIERS, WEBSITE_TIERS, parsePlan, tierLabel, tierPriceCents } from "@/lib/plans";
import { getBillingState, stripeBillingConnected } from "@/lib/billing";
import { PlanSwitcher } from "./plan-switcher";
import { SubscriptionCard } from "./subscription-card";
import { AddOnsCard } from "./addons-card";

export const dynamic = "force-dynamic";

export default async function PlanSettingsPage() {
  const user = (await getCurrentUser())!;
  const plan = (await getBillingState(user.id)) ?? parsePlan(user.plan);
  const priceTable: Record<string, Record<string, { monthly: number; annual: number }>> = {
    gallery: Object.fromEntries(
      GALLERY_TIERS.map((t) => [t, { monthly: tierPriceCents("gallery", t, "monthly"), annual: tierPriceCents("gallery", t, "annual") }]),
    ),
    website: Object.fromEntries(
      WEBSITE_TIERS.map((t) => [t, { monthly: tierPriceCents("website", t, "monthly"), annual: tierPriceCents("website", t, "annual") }]),
    ),
    studio: Object.fromEntries(
      STUDIO_TIERS.map((t) => [t, { monthly: tierPriceCents("studio", t, "monthly"), annual: tierPriceCents("studio", t, "annual") }]),
    ),
  };
  return (
    <div className="space-y-6">
      <PlanSwitcher
        initial={plan}
        options={{ gallery: GALLERY_TIERS, website: WEBSITE_TIERS, studio: STUDIO_TIERS }}
        unlocks={{ studioPro: ["retainers collected at booking", "manual approval of booking requests"] }}
      />
      <SubscriptionCard
        initialTiers={{ gallery: plan.gallery, website: plan.website, studio: plan.studio }}
        billing={plan.billing}
        options={{ gallery: GALLERY_TIERS, website: WEBSITE_TIERS, studio: STUDIO_TIERS }}
        priceTable={priceTable}
        stripeConnected={stripeBillingConnected()}
      />
      <AddOnsCard initial={plan.billing.addOns} prices={ADD_ON_PRICES} galleryTier={plan.gallery} />
      <div className="card p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-medium">Studio Manager Volume plans and account security</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Volume plans ($48, $64 and $96 a month, billed annually) add IP whitelisting and unlimited login
            sessions. Manage the allowlist and your signed in sessions on the security page. Bandwidth is not
            metered for any account in Pixora, so volume plans carry no bandwidth restriction to lift.
          </p>
        </div>
        <Link href="/settings/security" className="btn-secondary shrink-0">
          Open security settings
        </Link>
      </div>
      <div className="card p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-medium">
            Current plan:{" "}
            <span className="font-display">
              {tierLabel("gallery", plan.gallery)}, {tierLabel("website", plan.website)}, {tierLabel("studio", plan.studio)}
            </span>
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            The tables below show each product&rsquo;s tier structure and researched prices for reference.
          </p>
        </div>
        <Link href="/pricing" target="_blank" className="btn-secondary shrink-0">
          View public pricing page ↗
        </Link>
      </div>

      {PRICING.map((product) => (
        <div key={product.id} className="card p-5">
          <h3 className="font-medium">{product.name}</h3>
          <p className="text-xs text-neutral-400 mb-3">{product.tagline}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs text-neutral-400 uppercase tracking-wide">
                  <th className="py-1.5 font-medium">Plan</th>
                  <th className="py-1.5 font-medium">Yearly</th>
                  <th className="py-1.5 font-medium">Monthly</th>
                  <th className="py-1.5 font-medium">Unlocks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {product.plans.map((p) => (
                  <tr key={p.name} className={p.highlight ? "bg-neutral-50" : ""}>
                    <td className="py-2 pr-3 font-medium whitespace-nowrap">{p.name}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{p.annual}/mo</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{p.monthly}/mo</td>
                    <td className="py-2 text-neutral-600">{p.features.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {product.footnote && <p className="text-xs text-neutral-400 mt-2">{product.footnote}</p>}
        </div>
      ))}
    </div>
  );
}
