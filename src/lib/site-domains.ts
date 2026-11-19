// Phase 5B: subdomains and custom domains for websites.
// - Free subdomain: <slug>.<SITE_ROOT_DOMAIN> (default mypixelset.com).
// - Custom domain: the photographer points a CNAME at SITE_CNAME_TARGET (or,
//   for an apex domain, an A record at SITE_A_RECORD) and/or adds the TXT
//   record _pixelset.<domain> = pixelset-verify=<token>. A real DNS lookup
//   verifies it; only VERIFIED domains are routed by the middleware.
// - TLS certificates are issued by the host in front of the app (see
//   docs/WEBSITE-DOMAINS.md, Caddy on-demand TLS asks /api/site/tls-ask).
import { promises as dns } from "dns";
import { randomBytes } from "crypto";

export function siteRootDomain(): string {
  return (process.env.SITE_ROOT_DOMAIN || "mypixelset.com").toLowerCase();
}
export function cnameTarget(): string {
  return (process.env.SITE_CNAME_TARGET || `sites.${siteRootDomain()}`).toLowerCase();
}
export function aRecordTarget(): string {
  return process.env.SITE_A_RECORD || "";
}
export function subdomainUrl(slug: string): string {
  return `https://${slug}.${siteRootDomain()}`;
}

export function normalizeDomain(input: string): string {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function isValidDomain(d: string): boolean {
  return /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d);
}

export function newDomainToken(): string {
  return randomBytes(9).toString("hex");
}

export function isApex(domain: string): boolean {
  return domain.split(".").length === 2;
}

export interface DnsCheck {
  verified: boolean;
  note: string;
  cname: string[];
  a: string[];
  txt: string[];
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// Real DNS verification. Passes when ANY of: the CNAME points at the target,
// the apex A record matches SITE_A_RECORD, or the TXT token is present.
export async function checkDomainDns(domain: string, token: string): Promise<DnsCheck> {
  const target = cnameTarget();
  const [cname, a, txtRaw] = await Promise.all([
    safe(() => dns.resolveCname(domain), [] as string[]),
    safe(() => dns.resolve4(domain), [] as string[]),
    safe(() => dns.resolveTxt(`_pixelset.${domain}`), [] as string[][]),
  ]);
  const txt = txtRaw.map((parts) => parts.join(""));
  const cnameOk = cname.some((c) => c.toLowerCase().replace(/\.$/, "") === target);
  const aTarget = aRecordTarget();
  const aOk = !!aTarget && a.includes(aTarget);
  const txtOk = !!token && txt.includes(`pixelset-verify=${token}`);
  if (cnameOk || aOk || txtOk) {
    const how = cnameOk ? `CNAME points at ${target}` : aOk ? `A record points at ${aTarget}` : "TXT verification record found";
    return { verified: true, note: `Verified: ${how}.`, cname, a, txt };
  }
  let note: string;
  if (cname.length) note = `CNAME found (${cname.join(", ")}) but it does not point at ${target}.`;
  else if (a.length) note = `Domain resolves to ${a.join(", ")}, no CNAME to ${target}${aTarget ? ` and no A record at ${aTarget}` : ""}.`;
  else note = "No DNS records found yet. DNS changes can take up to 48 hours to spread.";
  if (!txtOk) note += ` TXT record _pixelset.${domain} with pixelset-verify=${token} not found.`;
  return { verified: false, note, cname, a, txt };
}
