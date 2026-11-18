export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "collection";
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function endOfDay(dateStr: string): Date {
  // Expires 11:59pm local time on the chosen date.
  const d = new Date(`${dateStr}T23:59:59`);
  return d;
}

export function isExpired(expiresAt: Date | null): boolean {
  return !!expiresAt && expiresAt.getTime() < Date.now();
}
