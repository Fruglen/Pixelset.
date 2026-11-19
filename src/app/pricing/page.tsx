import Link from "next/link";
import { ADD_ONS, PRICING } from "@/lib/pricing";
import { PIXORA_WORDMARK } from "@/lib/brand-assets";

export const metadata = {
  title: "Pricing, Pixora",
  description: "Simple pricing for Client Gallery, Website, Studio Manager and the full Pixora Suite.",
};

// Public Pixieset-style pricing pages, display only; in this replica every
// feature is unlocked regardless of plan.
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" aria-label="Pixora home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PIXORA_WORDMARK} alt="Pixora" className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <span className="text-neutral-900 font-medium">Pricing</span>
            <Link href="/login" className="text-neutral-500 hover:text-neutral-900">
              Log in
            </Link>
            <Link href="/signup" className="btn-primary !py-1.5">
              Get started free
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="text-center max-w-2xl mx-auto mb-4">
          <h1 className="font-display text-4xl mb-3">Simple pricing that grows with you</h1>
          <p className="text-neutral-500">
            Start free on every product. Upgrade a single product, or get everything with the Suite. Prices shown per
            month, billed yearly (monthly billing in parentheses).
          </p>
          <p className="text-xs text-neutral-400 mt-3">
            Plan limits and unlocks are enforced in the app. Billing itself is parked in this replica, so
            subscriptions run in simulated mode and nothing is charged.
          </p>
        </div>

        {PRICING.map((product) => (
          <section key={product.id} className="mt-14" id={product.id}>
            <div className="text-center mb-7">
              <h2 className="font-display text-2xl">{product.name}</h2>
              <p className="text-sm text-neutral-500 mt-1">{product.tagline}</p>
            </div>
            <div
              className={`grid gap-4 ${
                product.plans.length >= 5 ? "md:grid-cols-5" : product.plans.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"
              }`}
            >
              {product.plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-xl border p-5 flex flex-col ${
                    plan.highlight ? "border-neutral-900 shadow-lg relative" : "border-neutral-200"
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest bg-neutral-900 text-white rounded-full px-3 py-0.5">
                      Most popular
                    </span>
                  )}
                  <p className="text-sm font-medium">{plan.name}</p>
                  <p className="mt-2">
                    <span className="font-display text-3xl">{plan.annual}</span>
                    <span className="text-sm text-neutral-400">/mo</span>
                  </p>
                  <p className="text-xs text-neutral-400 mb-4">billed yearly ({plan.monthly} monthly)</p>
                  <ul className="space-y-1.5 text-sm text-neutral-600 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-neutral-900">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className={`mt-5 text-center text-sm rounded-md py-2 ${
                      plan.highlight ? "bg-neutral-900 text-white hover:bg-neutral-700" : "border border-neutral-300 hover:bg-neutral-50"
                    }`}
                  >
                    {plan.annual === "$0" ? "Start free" : `Choose ${plan.name}`}
                  </Link>
                </div>
              ))}
            </div>
            {product.footnote && <p className="text-center text-xs text-neutral-400 mt-4">{product.footnote}</p>}
          </section>
        ))}

        <section className="mt-14" id="add-ons">
          <div className="text-center mb-7">
            <h2 className="font-display text-2xl">Add-ons</h2>
            <p className="text-sm text-neutral-500 mt-1">Bolt-ons that ride on top of any plan, managed in Settings, Plan.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {ADD_ONS.map((addon) => (
              <div key={addon.id} className="rounded-xl border border-neutral-200 p-5 flex flex-col">
                <p className="text-sm font-medium">{addon.name}</p>
                <p className="mt-2">
                  <span className="font-display text-3xl">{addon.price}</span>
                  <span className="text-sm text-neutral-400"> {addon.unit}</span>
                </p>
                <p className="text-sm text-neutral-600 flex-1 mt-2">{addon.blurb}</p>
                <Link href="/signup" className="mt-5 text-center text-sm rounded-md py-2 border border-neutral-300 hover:bg-neutral-50">
                  Add in Settings, Plan
                </Link>
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-xs text-neutral-400 mt-16">
          All prices USD. Subscriptions auto renew; plan changes are prorated; cancellations are not refunded and
          paid access runs to the end of the period. Photo storage tiers are deliberately not part of this product.
        </p>
      </div>
    </div>
  );
}
