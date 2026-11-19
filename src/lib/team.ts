import { cookies } from "next/headers";
import { getCurrentSession } from "./auth";

// Team roles: Owner / Assistant / Second Shooter.
//
// Team members have their own logins (invite -> set password -> sign in).
// A member's session row carries their role, and that role is authoritative:
// it cannot be raised by editing cookies. The account owner can additionally
// preview a lower role with the "work as role" switcher (a cookie), which
// only ever downgrades the owner's own session. Destructive and money
// endpoints check the effective role server-side and refuse with 403.

export const ROLES = ["OWNER", "ASSISTANT", "SECOND_SHOOTER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ASSISTANT: "Assistant",
  SECOND_SHOOTER: "Second Shooter",
};

export type Permission =
  | "delete" // delete collections, invoices, contracts, orders, contacts
  | "payments" // mark invoices paid, refund, change payment settings
  | "settings" // account / team / store settings
  | "manage_store" // price sheets, coupons, gift cards, order statuses
  | "send_documents" // send invoices/contracts, run automations
  | "upload"; // add photos, edit galleries

const MATRIX: Record<Role, Permission[]> = {
  OWNER: ["delete", "payments", "settings", "manage_store", "send_documents", "upload"],
  ASSISTANT: ["manage_store", "send_documents", "upload"],
  SECOND_SHOOTER: ["upload"],
};

export function roleHas(role: string, permission: Permission): boolean {
  return (MATRIX[role as Role] ?? []).includes(permission);
}

export const PERMISSION_LABELS: { id: Permission; label: string }[] = [
  { id: "upload", label: "Upload photos & edit galleries" },
  { id: "send_documents", label: "Send invoices, contracts & reminders" },
  { id: "manage_store", label: "Manage store, orders & coupons" },
  { id: "settings", label: "Change account & payment settings" },
  { id: "payments", label: "Record payments & refunds" },
  { id: "delete", label: "Delete collections, invoices & orders" },
];

const ROLE_COOKIE = "pxl_role";

/** The role the current session is working as (Owner unless previewing a seat). */
export function activeRole(): Role {
  const v = cookies().get(ROLE_COOKIE)?.value;
  return ROLES.includes(v as Role) ? (v as Role) : "OWNER";
}

export function setActiveRole(role: Role) {
  cookies().set(ROLE_COOKIE, role, { httpOnly: true, sameSite: "lax", path: "/" });
}

/**
 * The role that actually governs this request. A team member's session role
 * (set at login from their TeamMember record) always wins; the owner's
 * session falls back to the "work as role" preview cookie.
 */
export async function effectiveRole(): Promise<Role> {
  const session = await getCurrentSession().catch(() => null);
  if (session && session.role !== "OWNER" && ROLES.includes(session.role as Role)) {
    return session.role as Role;
  }
  return activeRole();
}

/** True when the current session belongs to a team member login (not the owner). */
export async function isMemberSession(): Promise<boolean> {
  const session = await getCurrentSession().catch(() => null);
  return Boolean(session && session.role !== "OWNER");
}

/** Returns an error message when the effective role lacks the permission, else null. */
export async function permissionError(permission: Permission): Promise<string | null> {
  const role = await effectiveRole();
  if (roleHas(role, permission)) return null;
  return `Your role (${ROLE_LABELS[role]}) doesn't allow this, ask the studio Owner.`;
}
