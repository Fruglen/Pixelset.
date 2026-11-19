import { db } from "./db";

// Phase 5B: in-app notification feed (header bell + unread count).
// Fed by bookings, quote acceptances, invoice payments, contract signatures,
// questionnaire completions, submitted favorite lists, and store orders.

export type NotificationKind =
  | "BOOKING"
  | "QUOTE_ACCEPTED"
  | "INVOICE_PAID"
  | "CONTRACT_SIGNED"
  | "QUESTIONNAIRE_COMPLETED"
  | "LIST_SUBMITTED"
  | "ORDER"
  | "FORM_SUBMISSION"
  | "MESSAGE"
  | "SYSTEM";

export async function notify(
  userId: string,
  kind: NotificationKind,
  title: string,
  body = "",
  href = ""
) {
  try {
    await db.notification.create({ data: { userId, kind, title, body, href } });
  } catch {
    // Notifications never break the action that produced them.
  }
}
