// Phase 5B store: regional tax table, manual tax rates, named shipping methods,
// and store currency formatting. Pure functions so checkout and tests share them.

// ---------------------------------------------------------------- regions

export interface TaxRegion {
  country: "US" | "CA";
  code: string; // state or province code
  name: string;
  ratePct: number; // statewide / combined provincial sales tax
}

// Statewide base sales tax (US) and combined GST/HST/PST/QST (Canada), late 2026.
// County and city add-ons are not included; use a manual rate to add them.
export const TAX_REGIONS: TaxRegion[] = [
  ["AL", "Alabama", 4], ["AK", "Alaska", 0], ["AZ", "Arizona", 5.6], ["AR", "Arkansas", 6.5],
  ["CA", "California", 7.25], ["CO", "Colorado", 2.9], ["CT", "Connecticut", 6.35], ["DE", "Delaware", 0],
  ["DC", "District of Columbia", 6], ["FL", "Florida", 6], ["GA", "Georgia", 4], ["HI", "Hawaii", 4],
  ["ID", "Idaho", 6], ["IL", "Illinois", 6.25], ["IN", "Indiana", 7], ["IA", "Iowa", 6],
  ["KS", "Kansas", 6.5], ["KY", "Kentucky", 6], ["LA", "Louisiana", 5], ["ME", "Maine", 5.5],
  ["MD", "Maryland", 6], ["MA", "Massachusetts", 6.25], ["MI", "Michigan", 6], ["MN", "Minnesota", 6.875],
  ["MS", "Mississippi", 7], ["MO", "Missouri", 4.225], ["MT", "Montana", 0], ["NE", "Nebraska", 5.5],
  ["NV", "Nevada", 6.85], ["NH", "New Hampshire", 0], ["NJ", "New Jersey", 6.625], ["NM", "New Mexico", 4.875],
  ["NY", "New York", 4], ["NC", "North Carolina", 4.75], ["ND", "North Dakota", 5], ["OH", "Ohio", 5.75],
  ["OK", "Oklahoma", 4.5], ["OR", "Oregon", 0], ["PA", "Pennsylvania", 6], ["RI", "Rhode Island", 7],
  ["SC", "South Carolina", 6], ["SD", "South Dakota", 4.2], ["TN", "Tennessee", 7], ["TX", "Texas", 6.25],
  ["UT", "Utah", 6.1], ["VT", "Vermont", 6], ["VA", "Virginia", 5.3], ["WA", "Washington", 6.5],
  ["WV", "West Virginia", 6], ["WI", "Wisconsin", 5], ["WY", "Wyoming", 4],
]
  .map(([code, name, ratePct]): TaxRegion => ({ country: "US", code: String(code), name: String(name), ratePct: Number(ratePct) }))
  .concat(
    [
      ["AB", "Alberta", 5], ["BC", "British Columbia", 12], ["MB", "Manitoba", 12], ["NB", "New Brunswick", 15],
      ["NL", "Newfoundland and Labrador", 15], ["NS", "Nova Scotia", 14], ["NT", "Northwest Territories", 5],
      ["NU", "Nunavut", 5], ["ON", "Ontario", 13], ["PE", "Prince Edward Island", 15], ["QC", "Quebec", 14.975],
      ["SK", "Saskatchewan", 11], ["YT", "Yukon", 5],
    ].map(([code, name, ratePct]): TaxRegion => ({ country: "CA", code: String(code), name: String(name), ratePct: Number(ratePct) }))
  );

export const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "OTHER", name: "Other country" },
];

export function regionName(country: string, code: string): string {
  return TAX_REGIONS.find((r) => r.country === country && r.code === code)?.name ?? code;
}

// ---------------------------------------------------------------- tax

export interface TaxSettings {
  taxEnabled: boolean;
  taxMode: string; // MANUAL | AUTO
  taxRate: number; // default rate (manual mode fallback)
  taxNexus: string; // csv "US-TX,CA-ON"; empty = everywhere
}

export interface ManualRate {
  name: string;
  country: string;
  region: string;
  ratePct: number;
  active: boolean;
}

export interface ResolvedTax {
  ratePct: number;
  label: string; // shown at checkout and stored on the order
}

/**
 * Pick the tax rate for a buyer location. Manual rates always win (exact region,
 * then whole country). In AUTO mode the regional table fills the rest, limited
 * to the photographer's tax regions when any are set. In MANUAL mode the default
 * rate applies when no manual rate matches.
 */
export function resolveTax(settings: TaxSettings, rates: ManualRate[], country: string, region: string): ResolvedTax {
  if (!settings.taxEnabled) return { ratePct: 0, label: "" };
  const c = (country || "").toUpperCase();
  const r = (region || "").toUpperCase();
  const active = rates.filter((x) => x.active);
  const exact = active.find((x) => x.country.toUpperCase() === c && x.region.toUpperCase() === r && r);
  if (exact) return { ratePct: exact.ratePct, label: `${exact.name} (${exact.ratePct}%)` };
  const whole = active.find((x) => x.country.toUpperCase() === c && !x.region);
  if (whole) return { ratePct: whole.ratePct, label: `${whole.name} (${whole.ratePct}%)` };

  if (settings.taxMode === "AUTO") {
    const nexus = settings.taxNexus
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (nexus.length > 0 && !nexus.includes(`${c}-${r}`)) {
      return { ratePct: 0, label: "No tax, outside your tax regions" };
    }
    const row = TAX_REGIONS.find((x) => x.country === c && x.code === r);
    if (row) return { ratePct: row.ratePct, label: `${row.name} sales tax (${row.ratePct}%)` };
    if (!c) return { ratePct: 0, label: "Enter your location to calculate tax" };
    return { ratePct: 0, label: "No tax for this location" };
  }
  return settings.taxRate > 0
    ? { ratePct: settings.taxRate, label: `Tax (${settings.taxRate}%)` }
    : { ratePct: 0, label: "" };
}

// ---------------------------------------------------------------- shipping

export interface ShippingMethodRow {
  id: string;
  name: string;
  speed: string;
  appliesTo: string; // SELF | LAB | ALL
  baseCents: number;
  perItemCents: number;
  freeOverCents: number;
  active: boolean;
}

export interface ShipLine {
  selfFulfilled: boolean;
  isDigital: boolean;
  qty: number;
  unitCents: number;
  shippingCents: number; // legacy per product flat amount
  productId: string;
}

export interface ShippingOption {
  id: string;
  name: string;
  speed: string;
  cents: number;
}

export interface ShippingGroup {
  group: "SELF" | "LAB";
  label: string;
  options: ShippingOption[]; // empty = per product flat shipping applies
  selectedId: string;
  selectedName: string;
  cents: number;
}

export function methodRate(m: ShippingMethodRow, units: number, groupSubtotal: number): number {
  if (m.freeOverCents > 0 && groupSubtotal >= m.freeOverCents) return 0;
  return m.baseCents + m.perItemCents * Math.max(0, units - 1);
}

/**
 * Shipping quote per fulfillment group (studio printed vs lab printed). Each
 * group the cart contains gets its own method choice; with no methods set up
 * for a group, the older per product flat amounts apply.
 */
export function quoteShipping(
  lines: ShipLine[],
  methods: ShippingMethodRow[],
  selection: Record<string, string>
): { groups: ShippingGroup[]; total: number } {
  const groups: ShippingGroup[] = [];
  for (const group of ["SELF", "LAB"] as const) {
    const gl = lines.filter((l) => !l.isDigital && (group === "SELF" ? l.selfFulfilled : !l.selfFulfilled));
    if (gl.length === 0) continue;
    const units = gl.reduce((s, l) => s + l.qty, 0);
    const sub = gl.reduce((s, l) => s + l.qty * l.unitCents, 0);
    const available = methods.filter((m) => m.active && (m.appliesTo === "ALL" || m.appliesTo === group));
    const label = group === "SELF" ? "Shipped by the studio" : "Shipped by the lab";
    if (available.length === 0) {
      const seen = new Set<string>();
      let flat = 0;
      for (const l of gl) {
        if (seen.has(l.productId)) continue;
        seen.add(l.productId);
        flat += l.shippingCents;
      }
      groups.push({ group, label, options: [], selectedId: "", selectedName: "Standard", cents: flat });
      continue;
    }
    const options = available.map((m) => ({ id: m.id, name: m.name, speed: m.speed, cents: methodRate(m, units, sub) }));
    const chosen = options.find((o) => o.id === selection[group]) ?? options[0];
    groups.push({ group, label, options, selectedId: chosen.id, selectedName: chosen.name, cents: chosen.cents });
  }
  return { groups, total: groups.reduce((s, g) => s + g.cents, 0) };
}

// ---------------------------------------------------------------- currency

export const STORE_CURRENCIES = ["USD", "CAD", "EUR", "GBP", "AUD", "NZD"] as const;

export function formatStoreMoney(cents: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

// ---------------------------------------------------------------- frames

export interface FrameOption {
  name: string;
  priceCents: number;
}

export function parseFrames(raw: string | null | undefined): FrameOption[] {
  try {
    const v = JSON.parse(raw || "[]");
    if (!Array.isArray(v)) return [];
    return v
      .filter((f) => f && typeof f.name === "string" && f.name.trim())
      .map((f) => ({ name: String(f.name).trim().slice(0, 80), priceCents: Math.max(0, Math.round(Number(f.priceCents) || 0)) }))
      .slice(0, 20);
  } catch {
    return [];
  }
}

export const FRAMEABLE = ["PRINT", "CANVAS", "METAL", "ACRYLIC", "WOOD", "FRAMED"];
