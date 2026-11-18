import { cookies } from "next/headers";

// Team roles: Owner / Assistant / Second Shooter.
//
// The account login is always the Owner. The Team settings page keeps a member
// list and a "work as role" switcher (stored in a cookie) that downgrades the
// current session to a member's permission level, destructive and money
// endpoints check the active role server-side and refuse with 403.

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

/** Returns an error message when the active role lacks the permission, else null. */
export function permissionError(permission: Permission): string | null {
  const role = activeRole();
  if (roleHas(role, permission)) return null;
  return `Your role (${ROLE_LABELS[role]}) doesn't allow this, ask the studio Owner.`;
}
