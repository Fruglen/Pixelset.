import { db } from "./db";
import { ADD_ON_PRICES, PRICING } from "./pricing";

// Phase 5B: simulated plan state with enforced caps.
//
// Billing is parked by the owner's order, so a plan cannot be bought. The
// account still carries a plan (switchable in Settings > Plan, clearly labelled
// "no billing connected") and every free-tier cap from the research is
// enforced against it. The demo account defaults to the top tiers, which keeps
// every feature unlocked exactly as before.

export type GalleryTier = "free" | "basic" | "plus" | "pro" | "ultimate";
export type WebsiteTier = "free" | "plus" | "pro";
export type StudioTier = "free" | "plus" | "pro";

export interface PlanState {
  gallery: GalleryTier;
  website: WebsiteTier;
  studio: StudioTier;
  billing: BillingState;
  /** Account security state that rides in the same JSON (no schema change):
   *  the sign-in IP allowlist, a Studio Manager Volume plan feature. */
  security: { ipAllowlist: string[] };
}

export const DEFAULT_SECURITY: PlanState["security"] = { ipAllowlist: [] };

export function parseSecurity(v: unknown): PlanState["security"] {
  if (!v || typeof v !== "object") return { ipAllowlist: [] };
  const list = (v as Record<string, unknown>).ipAllowlist;
  if (!Array.isArray(list)) return { ipAllowlist: [] };
  return { ipAllowlist: list.filter((x): x is string => typeof x === "string").slice(0, 50) };
}

// ---------------------------------------------------------------------------
// Night build (Pricing lane): subscription billing state. Billing is parked
// by the owner's order, so this state machine runs in full (subscribe, renew,
// prorated changes, cancel at period end, add-ons, history) with a simulated
// processor when no Stripe key is configured, and through real Stripe
// Checkout when STRIPE_SECRET_KEY is set. Nothing here ever fakes a charge:
// simulated entries are labelled simulated in the history.
// The state rides inside the existing User.plan JSON so no schema change is
// needed; NIGHT-SCHEMA-NEEDS.md still asks for a real Subscription model.
// ---------------------------------------------------------------------------

export interface BillingHistoryEntry {
  at: string; // ISO date
  type: string; // SUBSCRIBE | RENEW | CHANGE | CANCEL | REACTIVATE | CLOSE | ADDON | AUTORENEW
  detail: string;
  amountCents: number;
}

export interface BillingState {
  status: "NONE" | "ACTIVE" | "CLOSED";
  cycle: "monthly" | "annual";
  periodStart: string | null;
  periodEnd: string | null;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  processor: "none" | "stripe";
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  pending: {
    gallery: GalleryTier;
    website: WebsiteTier;
    studio: StudioTier;
    cycle: "monthly" | "annual";
    sessionId: string;
  } | null;
  addOns: { editor: boolean; extraVideoHours: number; extraCampaignBlocks: number };
  /** Studio Manager Volume plan (researched $48/$64/$96 a month billed
   *  annually): unlocks IP whitelisting. Storage sizes are owner excluded. */
  volume: "" | "volume2" | "volume5" | "volume10";
  history: BillingHistoryEntry[];
}

export const DEFAULT_BILLING: BillingState = {
  status: "NONE",
  cycle: "annual",
  periodStart: null,
  periodEnd: null,
  autoRenew: true,
  cancelAtPeriodEnd: false,
  processor: "none",
  stripeCustomerId: "",
  stripeSubscriptionId: "",
  pending: null,
  addOns: { editor: false, extraVideoHours: 0, extraCampaignBlocks: 0 },
  volume: "",
  history: [],
};

export function billingIsDefault(b: BillingState): boolean {
  return (
    b.status === "NONE" &&
    !b.periodStart &&
    !b.periodEnd &&
    !b.cancelAtPeriodEnd &&
    !b.stripeSubscriptionId &&
    !b.pending &&
    !b.addOns.editor &&
    b.addOns.extraVideoHours === 0 &&
    b.addOns.extraCampaignBlocks === 0 &&
    b.volume === "" &&
    b.history.length === 0
  );
}

export function parseBilling(v: unknown): BillingState {
  const d = DEFAULT_BILLING;
  if (!v || typeof v !== "object") return { ...d, addOns: { ...d.addOns }, history: [] };
  const b = v as Record<string, unknown>;
  const add = (b.addOns ?? {}) as Record<string, unknown>;
  return {
    status: b.status === "ACTIVE" || b.status === "CLOSED" ? b.status : "NONE",
    cycle: b.cycle === "monthly" ? "monthly" : "annual",
    periodStart: typeof b.periodStart === "string" ? b.periodStart : null,
    periodEnd: typeof b.periodEnd === "string" ? b.periodEnd : null,
    autoRenew: b.autoRenew !== false,
    cancelAtPeriodEnd: b.cancelAtPeriodEnd === true,
    processor: b.processor === "stripe" ? "stripe" : "none",
    stripeCustomerId: typeof b.stripeCustomerId === "string" ? b.stripeCustomerId : "",
    stripeSubscriptionId: typeof b.stripeSubscriptionId === "string" ? b.stripeSubscriptionId : "",
    pending:
      b.pending && typeof b.pending === "object"
        ? (b.pending as BillingState["pending"])
        : null,
    addOns: {
      editor: add.editor === true,
      extraVideoHours: Math.max(0, Math.min(100, Number(add.extraVideoHours) || 0)),
      extraCampaignBlocks: Math.max(0, Math.min(100, Number(add.extraCampaignBlocks) || 0)),
    },
    volume: b.volume === "volume2" || b.volume === "volume5" || b.volume === "volume10" ? b.volume : "",
    history: Array.isArray(b.history) ? (b.history as BillingHistoryEntry[]).slice(-60) : [],
  };
}

export const TOP_PLAN: PlanState = {
  gallery: "ultimate",
  website: "pro",
  studio: "pro",
  billing: DEFAULT_BILLING,
  security: { ipAllowlist: [] },
};

export const GALLERY_TIERS: GalleryTier[] = ["free", "basic", "plus", "pro", "ultimate"];
export const WEBSITE_TIERS: WebsiteTier[] = ["free", "plus", "pro"];
export const STUDIO_TIERS: StudioTier[] = ["free", "plus", "pro"];

const INF = Number.POSITIVE_INFINITY;

export const GALLERY_LIMITS: Record<
  GalleryTier,
  {
    mobileApps: number;
    videoHours: number;
    maxDownloadPx: number | null; // null = original size allowed
    raw: boolean;
    video4k: boolean;
    campaignSendsPerMonth: number;
    commissionPct: number;
    removeBranding: boolean;
    customDomain: boolean;
    bulkSharing: boolean;
  }
> = {
  free: { mobileApps: 3, videoHours: 0, maxDownloadPx: 3600, raw: false, video4k: false, campaignSendsPerMonth: 0, commissionPct: 15, removeBranding: false, customDomain: false, bulkSharing: false },
  basic: { mobileApps: INF, videoHours: 0, maxDownloadPx: null, raw: false, video4k: false, campaignSendsPerMonth: 100, commissionPct: 0, removeBranding: true, customDomain: true, bulkSharing: false },
  plus: { mobileApps: INF, videoHours: 1, maxDownloadPx: null, raw: false, video4k: false, campaignSendsPerMonth: 500, commissionPct: 0, removeBranding: true, customDomain: true, bulkSharing: false },
  pro: { mobileApps: INF, videoHours: 2, maxDownloadPx: null, raw: true, video4k: true, campaignSendsPerMonth: 1000, commissionPct: 0, removeBranding: true, customDomain: true, bulkSharing: true },
  ultimate: { mobileApps: INF, videoHours: 5, maxDownloadPx: null, raw: true, video4k: true, campaignSendsPerMonth: 10000, commissionPct: 0, removeBranding: true, customDomain: true, bulkSharing: true },
};

export const WEBSITE_LIMITS: Record<
  WebsiteTier,
  { pages: number; photos: number; posts: number; customDomain: boolean; customFonts: boolean; customCode: boolean }
> = {
  free: { pages: 15, photos: 100, posts: 5, customDomain: false, customFonts: false, customCode: false },
  plus: { pages: INF, photos: INF, posts: INF, customDomain: true, customFonts: false, customCode: false },
  pro: { pages: INF, photos: INF, posts: INF, customDomain: true, customFonts: true, customCode: true },
};

export const STUDIO_LIMITS: Record<
  StudioTier,
  { contracts: number; quotes: number; questionnaires: number; sessionTypes: number; retainers: boolean; manualApproval: boolean }
> = {
  free: { contracts: 3, quotes: 3, questionnaires: 3, sessionTypes: 1, retainers: false, manualApproval: false },
  plus: { contracts: INF, quotes: INF, questionnaires: INF, sessionTypes: 3, retainers: false, manualApproval: false },
  pro: { contracts: INF, quotes: INF, questionnaires: INF, sessionTypes: INF, retainers: true, manualApproval: true },
};

export function parsePlan(raw: string | null | undefined): PlanState {
  if (!raw || raw === "SUITE_ULTIMATE") return { ...TOP_PLAN, billing: parseBilling(null) };
  try {
    const v = JSON.parse(raw);
    return {
      gallery: GALLERY_TIERS.includes(v.gallery) ? v.gallery : TOP_PLAN.gallery,
      website: WEBSITE_TIERS.includes(v.website) ? v.website : TOP_PLAN.website,
      studio: STUDIO_TIERS.includes(v.studio) ? v.studio : TOP_PLAN.studio,
      billing: parseBilling(v.billing),
      security: parseSecurity(v.security),
    };
  } catch {
    return { ...TOP_PLAN, billing: parseBilling(null) };
  }
}

export function serializePlan(p: PlanState): string {
  const billing = p.billing ?? DEFAULT_BILLING;
  const security = p.security ?? DEFAULT_SECURITY;
  if (
    p.gallery === "ultimate" &&
    p.website === "pro" &&
    p.studio === "pro" &&
    billingIsDefault(billing) &&
    security.ipAllowlist.length === 0
  )
    return "SUITE_ULTIMATE";
  return JSON.stringify({ gallery: p.gallery, website: p.website, studio: p.studio, billing, security });
}

export async function planFor(userId: string): Promise<PlanState> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { plan: true } });
  return parsePlan(u?.plan);
}

export function tierLabel(product: "gallery" | "website" | "studio", tier: string) {
  const names: Record<string, string> = { free: "Free", basic: "Basic", plus: "Plus", pro: "Pro", ultimate: "Ultimate" };
  const prod = product === "gallery" ? "Client Gallery" : product === "website" ? "Website" : "Studio Manager";
  return `${prod} ${names[tier] ?? tier}`;
}

/** Friendly cap error used by every enforcement point. */
export function capMessage(what: string, limit: number, tier: string) {
  return `Your plan (${tier}) allows ${limit} ${what}. Upgrade in Settings > Plan to add more.`;
}

export function fmtLimit(n: number) {
  return Number.isFinite(n) ? String(n) : "Unlimited";
}

/** Count the hours of video stored across all of a user's galleries. */
export async function videoHoursUsed(userId: string): Promise<number> {
  const agg = await db.photo.aggregate({
    where: { mediaType: "VIDEO", collection: { userId } },
    _sum: { durationSec: true },
  });
  return (agg._sum.durationSec ?? 0) / 3600;
}

/** Campaign emails sent by this user in the current calendar month. */
export async function campaignSendsThisMonth(userId: string): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return db.campaignSend.count({ where: { campaign: { userId }, createdAt: { gte: start } } });
}

/** Price of one tier for one billing period, in cents, from the pricing data. */
export function tierPriceCents(
  product: "gallery" | "website" | "studio",
  tier: string,
  cycle: "monthly" | "annual",
): number {
  const prod = PRICING.find((p) => p.id === product);
  const plan = prod?.plans.find((pl) => pl.name.toLowerCase() === tier.toLowerCase());
  if (!plan) return 0;
  const num = (s: string) => (parseInt(s.replace(/[^0-9]/g, ""), 10) || 0) * 100;
  // `annual` in the pricing data is the per-month price when billed yearly.
  return cycle === "annual" ? num(plan.annual) * 12 : num(plan.monthly);
}

/** Combined price of a full tier set for one period, in cents. */
export function planSetPriceCents(
  tiers: { gallery: GalleryTier; website: WebsiteTier; studio: StudioTier },
  cycle: "monthly" | "annual",
): number {
  return (
    tierPriceCents("gallery", tiers.gallery, cycle) +
    tierPriceCents("website", tiers.website, cycle) +
    tierPriceCents("studio", tiers.studio, cycle)
  );
}

/** Monthly price of the account's active add-ons, in cents. */
export function addOnsMonthlyCents(b: BillingState): number {
  return (
    (b.addOns.editor ? ADD_ON_PRICES.editor : 0) +
    b.addOns.extraVideoHours * ADD_ON_PRICES.videoHour +
    b.addOns.extraCampaignBlocks * ADD_ON_PRICES.campaignBlock
  );
}

/**
 * Gallery limits with purchased add-ons applied: extra video hours and extra
 * email campaign blocks raise the tier allowances.
 */
export async function effectiveGalleryLimits(userId: string) {
  const plan = await planFor(userId);
  const limits = { ...GALLERY_LIMITS[plan.gallery] };
  limits.videoHours += plan.billing.addOns.extraVideoHours;
  limits.campaignSendsPerMonth += plan.billing.addOns.extraCampaignBlocks * 5000;
  return { plan, limits };
}

/** Remaining email campaign sends this month for the account (tier + add-ons). */
export async function campaignAllowance(userId: string) {
  const { plan, limits } = await effectiveGalleryLimits(userId);
  const used = await campaignSendsThisMonth(userId);
  return { plan, limit: limits.campaignSendsPerMonth, used, remaining: Math.max(0, limits.campaignSendsPerMonth - used) };
}
