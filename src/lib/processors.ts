import { createHmac, timingSafeEqual } from "crypto";

// Night build: real payment processor code paths (Stripe + PayPal), fully
// env-gated per the owner's payments-parked order. When the server keys are
// absent every function reports "not connected" and the app keeps using its
// recorded (mock) checkout, labelled as a demo. Nothing here ever pretends a
// charge happened: live charges only occur when keys are configured AND the
// photographer has switched the method on in Studio Settings.

export interface ProcessorStatus {
  stripe: boolean; // STRIPE_SECRET_KEY present on the server
  stripeConnect: boolean; // STRIPE_PLATFORM_CLIENT_ID present (OAuth connect)
  paypal: boolean; // PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET present
  paypalSandbox: boolean;
}

export function processorStatus(): ProcessorStatus {
  return {
    stripe: !!process.env.STRIPE_SECRET_KEY,
    stripeConnect: !!process.env.STRIPE_PLATFORM_CLIENT_ID,
    paypal: !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    paypalSandbox: (process.env.PAYPAL_ENV || "sandbox") !== "live",
  };
}

/** Published card and wallet pricing used for fee estimates and display. */
export const STRIPE_FEE = { pct: 2.9, fixedCents: 30, label: "2.9% + $0.30" };
export const PAYPAL_FEE = { pct: 3.49, fixedCents: 49, label: "3.49% + $0.49" };

export function processorFeeCents(amountCents: number, method: string): number {
  if (amountCents <= 0) return 0;
  if (method === "card" || method === "stripe") return Math.round((amountCents * STRIPE_FEE.pct) / 100) + STRIPE_FEE.fixedCents;
  if (method === "paypal") return Math.round((amountCents * PAYPAL_FEE.pct) / 100) + PAYPAL_FEE.fixedCents;
  return 0; // manual / offline: no processor fee
}

/** Payment methods a client can be offered, given settings + server keys. */
export function clientPaymentMethods(profile: {
  pixelsetPaymentsConnected: boolean;
  stripeConnected: boolean;
  stripeAccount: string;
  paypalConnected: boolean;
  manualEnabled: boolean;
}) {
  const st = processorStatus();
  const stripeLive = st.stripe && (profile.pixelsetPaymentsConnected || (profile.stripeConnected && !!profile.stripeAccount));
  const paypalLive = st.paypal && profile.paypalConnected;
  return {
    stripeLive,
    paypalLive,
    // Stripe Checkout carries the wallets and BNPL rails when live.
    wallets: stripeLive ? ["Apple Pay", "Google Pay", "Link"] : [],
    bnpl: stripeLive ? ["Affirm", "Klarna"] : [],
    tapToPay: stripeLive, // Stripe Terminal Tap to Pay on the photographer's phone
  };
}

function stripeForm(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

export async function createStripeCheckout(opts: {
  amountCents: number;
  currency?: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  stripeAccount?: string; // connected account for direct charges
  customerEmail?: string;
}): Promise<{ url: string; id: string } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Stripe is not connected on this server (STRIPE_SECRET_KEY is not set)." };
  const params: Record<string, string> = {
    mode: "payment",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": (opts.currency || "usd").toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(opts.amountCents),
    "line_items[0][price_data][product_data][name]": opts.description.slice(0, 120),
    // Cards plus the wallets and buy now pay later rails Stripe enables per account.
    "payment_method_types[0]": "card",
    "payment_method_types[1]": "link",
    "payment_method_types[2]": "affirm",
    "payment_method_types[3]": "klarna",
  };
  for (const [k, v] of Object.entries(opts.metadata)) params[`metadata[${k}]`] = v;
  if (opts.customerEmail) params.customer_email = opts.customerEmail;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (opts.stripeAccount) headers["Stripe-Account"] = opts.stripeAccount;
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers, body: stripeForm(params) });
  const out = (await res.json().catch(() => ({}))) as { url?: string; id?: string; error?: { message?: string } };
  if (!res.ok || !out.url) return { error: out.error?.message || `Stripe answered ${res.status}` };
  return { url: out.url, id: out.id ?? "" };
}

export async function createStripeRefund(opts: {
  paymentIntent: string;
  amountCents?: number;
  stripeAccount?: string;
}): Promise<{ id: string } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Stripe is not connected on this server (STRIPE_SECRET_KEY is not set)." };
  const params: Record<string, string> = { payment_intent: opts.paymentIntent };
  if (opts.amountCents) params.amount = String(opts.amountCents);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (opts.stripeAccount) headers["Stripe-Account"] = opts.stripeAccount;
  const res = await fetch("https://api.stripe.com/v1/refunds", { method: "POST", headers, body: stripeForm(params) });
  const out = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!res.ok || !out.id) return { error: out.error?.message || `Stripe answered ${res.status}` };
  return { id: out.id };
}

/** Stripe Connect OAuth link for "your own Stripe account" onboarding. */
export function stripeConnectUrl(state: string, redirectUri: string): string | null {
  const clientId = process.env.STRIPE_PLATFORM_CLIENT_ID;
  if (!clientId) return null;
  const q = new URLSearchParams({ response_type: "code", client_id: clientId, scope: "read_write", redirect_uri: redirectUri, state });
  return `https://connect.stripe.com/oauth/authorize?${q.toString()}`;
}

export async function stripeConnectExchange(code: string): Promise<{ accountId: string } | { error: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Stripe is not connected on this server (STRIPE_SECRET_KEY is not set)." };
  const res = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: stripeForm({ grant_type: "authorization_code", code }),
  });
  const out = (await res.json().catch(() => ({}))) as { stripe_user_id?: string; error_description?: string };
  if (!res.ok || !out.stripe_user_id) return { error: out.error_description || `Stripe answered ${res.status}` };
  return { accountId: out.stripe_user_id };
}

/** Verify a Stripe webhook signature (v1 scheme) without the SDK. */
export function verifyStripeSignature(payload: string, header: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- PayPal

function paypalBase(): string {
  return (process.env.PAYPAL_ENV || "sandbox") === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export async function paypalAccessToken(): Promise<string | { error: string }> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) return { error: "PayPal is not connected on this server (PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not set)." };
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const out = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!res.ok || !out.access_token) return { error: `PayPal answered ${res.status}` };
  return out.access_token;
}

export async function createPayPalOrder(opts: {
  amountCents: number;
  currency?: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  customId: string;
}): Promise<{ approveUrl: string; id: string } | { error: string }> {
  const token = await paypalAccessToken();
  if (typeof token !== "string") return token;
  const res = await fetch(`${paypalBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          description: opts.description.slice(0, 127),
          custom_id: opts.customId,
          amount: { currency_code: (opts.currency || "USD").toUpperCase(), value: (opts.amountCents / 100).toFixed(2) },
        },
      ],
      application_context: { return_url: opts.returnUrl, cancel_url: opts.cancelUrl },
    }),
  });
  const out = (await res.json().catch(() => ({}))) as { id?: string; links?: { rel: string; href: string }[] };
  const approve = out.links?.find((l) => l.rel === "approve")?.href;
  if (!res.ok || !out.id || !approve) return { error: `PayPal answered ${res.status}` };
  return { approveUrl: approve, id: out.id };
}

export async function capturePayPalOrder(orderId: string): Promise<{ status: string } | { error: string }> {
  const token = await paypalAccessToken();
  if (typeof token !== "string") return token;
  const res = await fetch(`${paypalBase()}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const out = (await res.json().catch(() => ({}))) as { status?: string };
  if (!res.ok || !out.status) return { error: `PayPal answered ${res.status}` };
  return { status: out.status };
}
