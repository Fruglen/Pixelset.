import { db } from "./db";
import { templateById } from "./templates";
import { siteRootDomain } from "./site-domains";

// Phase 5B platform: guided setup checklists for Studio Manager and Website.
// Every step's "done" is computed from the account's real data, so the
// checklist ticks itself off as the photographer works (same idea as the
// store's Get Started list). Dismissal is stored on the user (setupDismissed).

export interface SetupStep {
  key: string;
  label: string;
  detail: string;
  href: string;
  done: boolean;
}

export interface SetupChecklist {
  id: "studio" | "website";
  title: string;
  steps: SetupStep[];
  doneCount: number;
  dismissed: boolean;
  next: SetupStep | null;
}

function finish(id: "studio" | "website", title: string, steps: SetupStep[], dismissedCsv: string): SetupChecklist {
  const doneCount = steps.filter((s) => s.done).length;
  return {
    id,
    title,
    steps,
    doneCount,
    dismissed: dismissedCsv.split(",").includes(id),
    next: steps.find((s) => !s.done) ?? null,
  };
}

export async function studioChecklist(userId: string): Promise<SetupChecklist> {
  const [u, profile, contacts, templates, docs, sessionTypes, bookings] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { brandLogoUrl: true, brandColor: true, setupDismissed: true } }),
    db.studioProfile.findUnique({ where: { userId } }),
    db.contact.count({ where: { userId } }),
    db.contractTemplate.count({ where: { userId } }),
    Promise.all([
      db.invoice.count({ where: { userId, status: { not: "DRAFT" } } }),
      db.quote.count({ where: { userId, status: { not: "DRAFT" } } }),
    ]),
    db.sessionType.count({ where: { userId, active: true, isMini: false } }),
    db.booking.count({ where: { userId } }),
  ]);
  const steps: SetupStep[] = [
    {
      key: "branding",
      label: "Add your branding",
      detail: "Upload a logo or pick a brand colour, used on contracts, invoices and booking pages.",
      href: "/settings#brand",
      done: !!(u?.brandLogoUrl || u?.brandColor),
    },
    {
      key: "profile",
      label: "Complete your business profile",
      detail: "Business email, phone and address appear on invoices and emails.",
      href: "/studio/settings",
      done: !!(profile && (profile.businessEmail || profile.businessPhone) && profile.businessAddress),
    },
    {
      key: "contacts",
      label: "Add or import your contacts",
      detail: "Bring in past and current clients so documents can be sent to them.",
      href: "/studio/contacts",
      done: contacts > 0,
    },
    {
      key: "payments",
      label: "Set up payments",
      detail: "Choose how clients pay (mocked per the owner's payments exclusion, no money moves).",
      href: "/studio/settings",
      done: !!(profile && (profile.pixelsetPaymentsConnected || profile.stripeConnected || profile.paypalConnected || profile.manualEnabled)),
    },
    {
      key: "contract",
      label: "Create your first contract template",
      detail: "A reusable contract with smart fields, ready to attach to sessions.",
      href: "/studio/contracts",
      done: templates > 0,
    },
    {
      key: "document",
      label: "Send your first invoice or quote",
      detail: "Send a real document to a client.",
      href: "/studio/invoices",
      done: docs[0] + docs[1] > 0,
    },
    {
      key: "booking",
      label: "Set up online booking",
      detail: "Create a session type with availability so clients can book you.",
      href: "/studio/sessions",
      done: sessionTypes > 0,
    },
    {
      key: "first-booking",
      label: "Get your first booking",
      detail: "Share your booking page link, or add a booking to the calendar.",
      href: "/studio/calendar",
      done: bookings > 0,
    },
  ];
  return finish("studio", "Set up Studio Manager", steps, u?.setupDismissed ?? "");
}

export async function websiteChecklist(userId: string): Promise<SetupChecklist | null> {
  const [u, w] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { setupDismissed: true } }),
    db.website.findUnique({ where: { userId }, include: { pages: true } }),
  ]);
  if (!w) return null;
  const tpl = templateById(w.template);
  const created = w.createdAt.getTime();
  const later = (d: Date | null | undefined) => !!d && d.getTime() - created > 10_000;
  const visible = w.pages.filter((p) => p.visible);
  const steps: SetupStep[] = [
    {
      key: "template",
      label: "Pick a template",
      detail: "Choose the look your site starts from. You can switch any time.",
      href: "/website/design",
      done: w.templateChosen,
    },
    {
      key: "content",
      label: "Replace the sample content",
      detail: "Edit pages with your own photos and words.",
      href: "/website",
      done: w.pages.some((p) => later(p.updatedAt)),
    },
    {
      key: "customise",
      label: "Customise your design",
      detail: "Logo, colours, fonts and header style.",
      href: "/website/design",
      done: !!w.logoUrl || !!tpl && (w.palette !== tpl.palette || w.fontTheme !== tpl.fontTheme || w.headerStyle !== tpl.headerStyle),
    },
    {
      key: "seo",
      label: "Complete the SEO checklist",
      detail: "Give every visible page a search title and description.",
      href: "/website/seo",
      done: visible.length > 0 && visible.every((p) => p.seoTitle.trim() && p.seoDescription.trim()),
    },
    {
      key: "domain",
      label: "Connect your domain",
      detail: `Your free address ${w.slug}.${siteRootDomain()} is already live. Connect your own domain when ready.`,
      href: "/website/settings",
      done: w.domainStatus === "VERIFIED",
    },
    {
      key: "publish",
      label: "Publish your changes",
      detail: "Make your edits live for visitors.",
      href: "/website",
      done: w.published && later(w.publishedAt),
    },
  ];
  return finish("website", "Set up your website", steps, u?.setupDismissed ?? "");
}
