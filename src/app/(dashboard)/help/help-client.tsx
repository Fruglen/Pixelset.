"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HELP_GUIDES, HELP_PRODUCTS, searchGuides } from "@/lib/help-guides";

export default function HelpClient({ initialQuery }: { initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [product, setProduct] = useState<string>("All");
  const results = useMemo(() => {
    const found = searchGuides(q);
    return product === "All" ? found : found.filter((g) => g.product === product);
  }, [q, product]);

  return (
    <div className="space-y-5">
      <div className="card p-4 space-y-3">
        <input
          className="input"
          type="search"
          placeholder="Search the guides, for example download PIN or campaign"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search help guides"
          data-testid="help-search"
        />
        <div className="flex flex-wrap gap-2">
          {["All", ...HELP_PRODUCTS].map((p) => (
            <button
              key={p}
              onClick={() => setProduct(p)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                product === p ? "border-brand-500 bg-brand-50 text-brand-800" : "border-neutral-200 text-neutral-600 hover:border-brand-300"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-neutral-500" aria-live="polite">
        {results.length} of {HELP_GUIDES.length} guides
      </p>

      {results.length === 0 ? (
        <div className="card p-6 text-sm text-neutral-600">
          No guide matches that search. Try fewer words, or ask us through the Support button.
        </div>
      ) : (
        <div className="grid gap-4">
          {results.map((g) => (
            <article key={g.id} id={g.id} className="card p-5 scroll-mt-20" data-testid="help-guide">
              <p className="text-xs uppercase tracking-wide text-brand-700">{g.product}</p>
              <h2 className="font-display text-lg mt-0.5">{g.title}</h2>
              <p className="text-sm text-neutral-600 mt-1">{g.summary}</p>
              <ol className="list-decimal pl-5 mt-3 space-y-1.5 text-sm text-neutral-800">
                {g.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              {g.links.length ? (
                <div className="flex flex-wrap gap-3 mt-3">
                  {g.links.map((l) => (
                    <Link key={l.href} href={l.href} className="text-sm underline text-brand-700">
                      Open {l.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
