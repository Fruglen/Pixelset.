import Link from "next/link";
import { PRICING } from "@/lib/pricing";

export const metadata = {
  title: "Pricing, Pixelset",
  description: "Simple pricing for Client Gallery, Website, Studio Manager and the full Pixelset Suite.",
};

// Public Pixieset-style pricing pages, display only; in this replica every
// feature is unlocked regardless of plan.
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-display text-xl tracking-tight">
            Pixelset
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
            This is a working replica, every feature below is unlocked in the app regardless of plan.
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

        <p className="text-center text-xs text-neutral-400 mt-16">
          All prices USD. Photo storage tiers are deliberately not part of this product.
        </p>
      </div>
    </div>
  );
}
