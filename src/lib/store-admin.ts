// Phase 5B store admin input cleaners (tax rates, shipping methods).

export function cleanRate(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 80);
  if (typeof body.country === "string") data.country = body.country.trim().toUpperCase().slice(0, 10) || "US";
  if (typeof body.region === "string") data.region = body.region.trim().toUpperCase().slice(0, 10);
  if ("ratePct" in body) data.ratePct = Math.min(50, Math.max(0, Number(body.ratePct) || 0));
  if (typeof body.active === "boolean") data.active = body.active;
  return data;
}

export function cleanMethod(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  const cents = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 80);
  if (typeof body.speed === "string") data.speed = body.speed.trim().slice(0, 80);
  if (body.appliesTo === "SELF" || body.appliesTo === "LAB" || body.appliesTo === "ALL") data.appliesTo = body.appliesTo;
  if ("baseCents" in body) data.baseCents = cents(body.baseCents);
  if ("perItemCents" in body) data.perItemCents = cents(body.perItemCents);
  if ("freeOverCents" in body) data.freeOverCents = cents(body.freeOverCents);
  if (typeof body.active === "boolean") data.active = body.active;
  if ("order" in body) data.order = Math.round(Number(body.order) || 0);
  return data;
}

