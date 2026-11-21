// Fix batch 2026-11-20: in dashboard support. Messages from the support
// bubble are stored in the app and read in the site owner's support inbox
// (/support-inbox). The owner is whoever's account email is listed in
// SUPPORT_INBOX_EMAILS (comma separated); until that is set, the demo
// login is the owner so the inbox is reachable on a fresh deploy.

export const SUPPORT_TOPICS = [
  { id: "GENERAL", label: "General question" },
  { id: "GALLERY", label: "Client Gallery" },
  { id: "WEBSITE", label: "Website" },
  { id: "STUDIO", label: "Studio Manager" },
  { id: "STORE", label: "Store" },
  { id: "BILLING", label: "Plan and billing" },
  { id: "BUG", label: "Something is broken" },
] as const;

export function supportOwnerEmails(): string[] {
  const raw = process.env.SUPPORT_INBOX_EMAILS || "demo@pixelset.app";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSupportOwner(email: string | null | undefined): boolean {
  return !!email && supportOwnerEmails().includes(email.trim().toLowerCase());
}
