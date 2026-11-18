import Link from "next/link";
import { PRICING } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default function PlanSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="card p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-medium">
            Current plan: <span className="font-display">Pixelset Suite, Ultimate (replica)</span>
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Every feature across all products is unlocked in this replica, the tables below replicate Pixieset&rsquo;s
            tier structure for reference.
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
