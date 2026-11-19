import { db } from "./db";
import {
  BillingState,
  GalleryTier,
  PlanState,
  StudioTier,
  WebsiteTier,
  addOnsMonthlyCents,
  parsePlan,
  planSetPriceCents,
  serializePlan,
} from "./plans";

// ---------------------------------------------------------------------------
// Night build (Pricing lane): subscription billing for plans and add-ons.
//
// Researched behaviour (Pixieset): subscriptions auto renew, plan changes are
// prorated, cancellations are NOT refunded and paid access runs to the end of
// the paid period, after which the account drops to the Free plans.
//
// Billing is parked by the owner's order. With no STRIPE_SECRET_KEY on the
// server every step below runs as a clearly labelled simulated subscription:
// the full state machine (subscribe, prorated change, renewal, cancellation,
// add-ons, history) works, and nothing is ever charged. With a key set, new
// subscriptions go through real Stripe Checkout and changes update the real
// Stripe subscription with proration; the local state mirrors Stripe.
// ---------------------------------------------------------------------------

export interface TierSet {
  gallery: GalleryTier;
  website: WebsiteTier;
  studio: StudioTier;
}

const DAY = 86400000;

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function periodEndFor(start: Date, cycle: "monthly" | "annual"): Date {
  return addMonths(start, cycle === "annual" ? 12 : 1);
}

function pushHistory(b: BillingState, type: string, detail: string, amountCents = 0) {
  b.history = [...b.history, { at: new Date().toISOString(), type, detail, amountCents }].slice(-60);
}

async function loadUser(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, plan: true },
  });
}

async function save(userId: string, state: PlanState) {
  await db.user.update({ where: { id: userId }, data: { plan: serializePlan(state) } });
}

export function stripeBillingConnected(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

// ---------------------------------------------------------------------------
// Lifecycle: renewal and end of period closing, run lazily whenever the
// billing state is read (the same lazy pattern the app uses for scheduled
// contract sending and expiry reminders).
// ---------------------------------------------------------------------------

export function processBilling(state: PlanState, now = new Date()): boolean {
  const b = state.billing;
  if (b.status !== "ACTIVE" || !b.periodEnd) return false;
  if (new Date(b.periodEnd) > now) return false;

  if (b.cancelAtPeriodEnd || !b.autoRenew) {
    state.gallery = "free";
    state.website = "free";
    state.studio = "free";
    b.status = "CLOSED";
    b.cancelAtPeriodEnd = false;
    b.stripeSubscriptionId = "";
    pushHistory(
      b,
      "CLOSE",
      "The paid period ended, so the account moved to the Free plans. No refund is due: cancellations are not refunded under the policy, and paid access ran to the end of the period.",
    );
    return true;
  }

  let start = new Date(b.periodEnd as string);
  let end = periodEndFor(start, b.cycle);
  let guard = 0;
  while (end <= now && guard++ < 24) {
    start = end;
    end = periodEndFor(start, b.cycle);
  }
  b.periodStart = start.toISOString();
  b.periodEnd = end.toISOString();
  pushHistory(
    b,
    "RENEW",
    b.processor === "stripe"
      ? "Subscription auto renewed for a new period through Stripe."
      : "Subscription auto renewed for a new period (simulated, no billing connected, nothing charged).",
    planSetPriceCents(state, b.cycle),
  );
  return true;
}

/** Read the account's plan + billing state, applying any due lifecycle step. */
export async function getBillingState(userId: string): Promise<PlanState | null> {
  const u = await loadUser(userId);
  if (!u) return null;
  const state = parsePlan(u.plan);
  if (state.billing.processor === "stripe" && state.billing.stripeSubscriptionId) {
    await syncStripeMirror(state).catch(() => undefined);
  }
  if (processBilling(state)) await save(userId, state);
  return state;
}

// ---------------------------------------------------------------------------
// Stripe (only used when STRIPE_SECRET_KEY is set)
// ---------------------------------------------------------------------------

async function stripeForm(
  path: string,
  params: Record<string, string>,
  method: "GET" | "POST" = "POST",
): Promise<Record<string, unknown>> {
  const key = process.env.STRIPE_SECRET_KEY as string;
  const url = method === "GET" && Object.keys(params).length
    ? `https://api.stripe.com/v1/${path}?${new URLSearchParams(params).toString()}`
    : `https://api.stripe.com/v1/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" ? new URLSearchParams(params).toString() : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message || `Stripe request failed (${res.status})`);
  }
  return json;
}

/** Find or create the single Stripe product that carries plan prices. */
async function stripeProductId(b: BillingState): Promise<string> {
  const found = await stripeForm("products/search", { query: "name:'Pixelset Plans'" }, "GET");
  const data = (found.data as Record<string, unknown>[] | undefined) ?? [];
  if (data.length && typeof data[0].id === "string") return data[0].id;
  const created = await stripeForm("products", { name: "Pixelset Plans", description: "Pixelset plan subscription" });
  return created.id as string;
}

/** Create a recurring Stripe price for an amount (prices are immutable). */
async function stripePriceId(b: BillingState, amountCents: number, cycle: "monthly" | "annual"): Promise<string> {
  const product = await stripeProductId(b);
  const price = await stripeForm("prices", {
    product,
    currency: "usd",
    unit_amount: String(amountCents),
    "recurring[interval]": cycle === "annual" ? "year" : "month",
    nickname: `plans-${amountCents}-${cycle}`,
  });
  return price.id as string;
}

/** Mirror a live Stripe subscription's period and status into local state. */
async function syncStripeMirror(state: PlanState) {
  const b = state.billing;
  if (!b.stripeSubscriptionId) return;
  const sub = await stripeForm(`subscriptions/${b.stripeSubscriptionId}`, {}, "GET");
  const status = typeof sub.status === "string" ? sub.status : "";
  const periodEnd = typeof sub.current_period_end === "number" ? new Date(sub.current_period_end * 1000) : null;
  const periodStart = typeof sub.current_period_start === "number" ? new Date(sub.current_period_start * 1000) : null;
  if (periodStart) b.periodStart = periodStart.toISOString();
  if (periodEnd) b.periodEnd = periodEnd.toISOString();
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    b.cancelAtPeriodEnd = true;
  }
  if (sub.cancel_at_period_end === true) b.cancelAtPeriodEnd = true;
}

// ---------------------------------------------------------------------------
// Subscribe / change with proration
// ---------------------------------------------------------------------------

export interface ChangePreview {
  currentPriceCents: number;
  newPriceCents: number;
  creditCents: number;
  dueCents: number;
  netCents: number;
  cycleChanged: boolean;
  periodEnd: string | null;
}

export function previewChange(state: PlanState, target: TierSet, cycle: "monthly" | "annual"): ChangePreview {
  const b = state.billing;
  const currentPrice = planSetPriceCents(state, b.cycle);
  const newPrice = planSetPriceCents(target, cycle);
  if (b.status !== "ACTIVE" || !b.periodStart || !b.periodEnd) {
    return { currentPriceCents: currentPrice, newPriceCents: newPrice, creditCents: 0, dueCents: newPrice, netCents: newPrice, cycleChanged: cycle !== b.cycle, periodEnd: b.periodEnd };
  }
  const start = new Date(b.periodStart).getTime();
  const end = new Date(b.periodEnd).getTime();
  const now = Date.now();
  const frac = Math.max(0, Math.min(1, (end - now) / Math.max(1, end - start)));
  const credit = Math.round(currentPrice * frac);
  if (cycle !== b.cycle) {
    return { currentPriceCents: currentPrice, newPriceCents: newPrice, creditCents: credit, dueCents: newPrice, netCents: newPrice - credit, cycleChanged: true, periodEnd: b.periodEnd };
  }
  const due = Math.round(newPrice * frac);
  return { currentPriceCents: currentPrice, newPriceCents: newPrice, creditCents: credit, dueCents: due, netCents: due - credit, cycleChanged: false, periodEnd: b.periodEnd };
}

function applyTiers(state: PlanState, target: TierSet) {
  state.gallery = target.gallery;
  state.website = target.website;
  state.studio = target.studio;
}

/**
 * Subscribe a free account, or change an active subscription's plans with
 * proration. Returns a Stripe Checkout URL when real billing is connected
 * and money is due for a brand new subscription; otherwise the change is
 * applied immediately as a simulated subscription.
 */
export async function subscribeOrChange(
  userId: string,
  target: TierSet,
  cycle: "monthly" | "annual",
  origin: string,
): Promise<{ ok: true; url?: string; simulated?: boolean; state: PlanState }> {
  const u = await loadUser(userId);
  if (!u) throw new Error("Account not found");
  const state = parsePlan(u.plan);
  processBilling(state);
  const b = state.billing;
  const newPrice = planSetPriceCents(target, cycle);
  const now = new Date();

  // Downgrading everything to Free is a cancellation: paid access runs to
  // the end of the period, per the policy (no refunds).
  if (newPrice === 0) {
    if (b.status === "ACTIVE") {
      b.cancelAtPeriodEnd = true;
      pushHistory(b, "CANCEL", `Downgrade to the Free plans scheduled for ${b.periodEnd ? new Date(b.periodEnd).toLocaleDateString() : "the end of the period"}. No refund is due under the cancellation policy.`);
      await save(userId, state);
      return { ok: true, simulated: b.processor !== "stripe", state };
    }
    applyTiers(state, target);
    await save(userId, state);
    return { ok: true, simulated: true, state };
  }

  // Real Stripe path for a brand new subscription.
  if (stripeBillingConnected() && b.status !== "ACTIVE") {
    const priceId = await stripePriceId(b, newPrice, cycle);
    const session = await stripeForm("checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      customer_email: u.email,
      success_url: `${origin}/api/account/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/settings/plan?billing=cancelled`,
    });
    b.pending = { ...target, cycle, sessionId: session.id as string };
    await save(userId, state);
    return { ok: true, url: session.url as string, state };
  }

  // Real Stripe path for changing an existing subscription: update the price
  // and let Stripe create prorations.
  if (stripeBillingConnected() && b.processor === "stripe" && b.stripeSubscriptionId) {
    const sub = await stripeForm(`subscriptions/${b.stripeSubscriptionId}`, {}, "GET");
    const items = (sub.items as { data?: Record<string, unknown>[] } | undefined)?.data ?? [];
    const itemId = items.length ? (items[0].id as string) : "";
    if (itemId) {
      const priceId = await stripePriceId(b, newPrice, cycle);
      await stripeForm(`subscriptions/${b.stripeSubscriptionId}`, {
        "items[0][id]": itemId,
        "items[0][price]": priceId,
        proration_behavior: "create_prorations",
      });
      const preview = previewChange(state, target, cycle);
      applyTiers(state, target);
      b.cycle = cycle;
      pushHistory(b, "CHANGE", "Plan changed through Stripe with proration.", preview.netCents);
      await save(userId, state);
      return { ok: true, state };
    }
  }

  // Simulated path (billing parked): full state machine, nothing charged.
  if (b.status !== "ACTIVE") {
    applyTiers(state, target);
    b.status = "ACTIVE";
    b.cycle = cycle;
    b.processor = "none";
    b.periodStart = now.toISOString();
    b.periodEnd = periodEndFor(now, cycle).toISOString();
    b.cancelAtPeriodEnd = false;
    b.autoRenew = true;
    pushHistory(b, "SUBSCRIBE", "Subscribed (simulated, no billing connected, nothing charged).", newPrice);
    await save(userId, state);
    return { ok: true, simulated: true, state };
  }

  const preview = previewChange(state, target, cycle);
  applyTiers(state, target);
  if (preview.cycleChanged) {
    b.cycle = cycle;
    b.periodStart = now.toISOString();
    b.periodEnd = periodEndFor(now, cycle).toISOString();
  }
  pushHistory(
    b,
    "CHANGE",
    `Plan changed with proration (simulated, nothing charged): credit ${fmt(preview.creditCents)} for the unused part of the old plan, ${fmt(preview.dueCents)} for the new plan to the end of the period.`,
    preview.netCents,
  );
  await save(userId, state);
  return { ok: true, simulated: true, state };
}

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Complete a Stripe Checkout return: verify the session, then activate. */
export async function activateStripeCheckout(userId: string, sessionId: string): Promise<boolean> {
  const u = await loadUser(userId);
  if (!u) return false;
  const state = parsePlan(u.plan);
  const b = state.billing;
  if (!b.pending || b.pending.sessionId !== sessionId) return false;
  const session = await stripeForm(`checkout/sessions/${sessionId}`, {}, "GET");
  if (session.payment_status !== "paid" && session.status !== "complete") return false;
  const target = { gallery: b.pending.gallery, website: b.pending.website, studio: b.pending.studio };
  applyTiers(state, target);
  b.status = "ACTIVE";
  b.cycle = b.pending.cycle;
  b.processor = "stripe";
  b.stripeCustomerId = typeof session.customer === "string" ? session.customer : "";
  b.stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : "";
  b.periodStart = new Date().toISOString();
  b.periodEnd = periodEndFor(new Date(), b.cycle).toISOString();
  b.cancelAtPeriodEnd = false;
  b.pending = null;
  pushHistory(b, "SUBSCRIBE", "Subscribed through Stripe Checkout.", planSetPriceCents(state, b.cycle));
  await save(userId, state);
  return true;
}

// ---------------------------------------------------------------------------
// Cancel / reactivate / auto renew / add-ons
// ---------------------------------------------------------------------------

export async function cancelSubscription(userId: string): Promise<PlanState> {
  const state = await getBillingState(userId);
  if (!state) throw new Error("Account not found");
  const b = state.billing;
  if (b.status === "ACTIVE") {
    b.cancelAtPeriodEnd = true;
    if (b.processor === "stripe" && b.stripeSubscriptionId) {
      await stripeForm(`subscriptions/${b.stripeSubscriptionId}`, { cancel_at_period_end: "true" }).catch(() => undefined);
    }
    pushHistory(
      b,
      "CANCEL",
      `Cancellation scheduled. Paid plans stay active until ${b.periodEnd ? new Date(b.periodEnd).toLocaleDateString() : "the end of the period"}, then the account moves to the Free plans. No refund is due under the cancellation policy.`,
    );
    await save(userId, state);
  }
  return state;
}

export async function reactivateSubscription(userId: string): Promise<PlanState> {
  const state = await getBillingState(userId);
  if (!state) throw new Error("Account not found");
  const b = state.billing;
  if (b.status === "ACTIVE" && b.cancelAtPeriodEnd) {
    b.cancelAtPeriodEnd = false;
    if (b.processor === "stripe" && b.stripeSubscriptionId) {
      await stripeForm(`subscriptions/${b.stripeSubscriptionId}`, { cancel_at_period_end: "false" }).catch(() => undefined);
    }
    pushHistory(b, "REACTIVATE", "Cancellation undone. The subscription will renew as normal.");
    await save(userId, state);
  }
  return state;
}

export async function setAutoRenew(userId: string, value: boolean): Promise<PlanState> {
  const state = await getBillingState(userId);
  if (!state) throw new Error("Account not found");
  state.billing.autoRenew = value;
  pushHistory(state.billing, "AUTORENEW", value ? "Auto renewal turned on." : "Auto renewal turned off. The plans will drop to Free at the end of the paid period.");
  await save(userId, state);
  return state;
}

export async function setAddOn(
  userId: string,
  key: "editor" | "extraVideoHours" | "extraCampaignBlocks",
  value: boolean | number,
): Promise<PlanState> {
  const state = await getBillingState(userId);
  if (!state) throw new Error("Account not found");
  const b = state.billing;
  const before = addOnsMonthlyCents(b);
  if (key === "editor") b.addOns.editor = value === true;
  if (key === "extraVideoHours") b.addOns.extraVideoHours = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  if (key === "extraCampaignBlocks") b.addOns.extraCampaignBlocks = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const after = addOnsMonthlyCents(b);
  const label =
    key === "editor"
      ? b.addOns.editor
        ? "Photo Editor add-on activated"
        : "Photo Editor add-on removed"
      : key === "extraVideoHours"
        ? `Extra video add-on set to ${b.addOns.extraVideoHours} hour${b.addOns.extraVideoHours === 1 ? "" : "s"} a month`
        : `Extra email campaigns add-on set to ${b.addOns.extraCampaignBlocks} block${b.addOns.extraCampaignBlocks === 1 ? "" : "s"} (5,000 sends each) a month`;
  pushHistory(
    b,
    "ADDON",
    `${label} (simulated, no billing connected, nothing charged). Add-ons now total ${fmt(after)} a month.`,
    after - before,
  );
  await save(userId, state);
  return state;
}

// ---------------------------------------------------------------------------
// Studio Manager Volume plan (researched $48/$64/$96 a month billed
// annually). Confers the IP allowlist and, per the research, unlimited
// login sessions and no bandwidth restrictions; Pixelset never meters
// sessions or bandwidth for anyone, so the allowlist is the working part.
// Simulated while billing is parked.
// ---------------------------------------------------------------------------

export async function setVolume(
  userId: string,
  volume: "" | "volume2" | "volume5" | "volume10",
): Promise<PlanState> {
  const state = await getBillingState(userId);
  if (!state) throw new Error("Account not found");
  state.billing.volume = volume;
  pushHistory(
    state.billing,
    "VOLUME",
    volume
      ? `Studio Manager Volume plan set to ${volume.replace("volume", "")} TB (simulated, no billing connected, nothing charged). IP whitelisting is now available in Settings > Security.`
      : "Studio Manager Volume plan removed (simulated). The IP allowlist stays saved but is no longer enforced.",
  );
  await save(userId, state);
  return state;
}
