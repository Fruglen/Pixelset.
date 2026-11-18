import { db } from "./db";
import { renderSmartFields, type SmartFieldContext } from "./studio";

// Customizable reminder email templates. Defaults below; the photographer can
// edit subject + body per template in Settings > Email Templates. Smart fields
// use the same {{token}} renderer as contracts.

export interface EmailTemplateDef {
  key: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  tokens: string[];
}

export const DEFAULT_TEMPLATES: EmailTemplateDef[] = [
  {
    key: "INVOICE_REMINDER",
    name: "Invoice payment reminder",
    description: "Sent by the invoice-unpaid automation (and manual sends) when a payment is outstanding.",
    subject: "Friendly reminder: invoice {{invoice_number}} from {{business_name}}",
    body: `Hi {{client_name}},

Just a gentle reminder that invoice {{invoice_number}} ({{invoice_amount}}) is still outstanding{{due_phrase}}.

You can view and pay it securely here: {{payment_link}}

Thank you!
{{business_name}}`,
    tokens: ["{{client_name}}", "{{invoice_number}}", "{{invoice_amount}}", "{{due_phrase}}", "{{payment_link}}", "{{business_name}}"],
  },
  {
    key: "GALLERY_NUDGE",
    name: "Gallery favorites nudge",
    description: "Sent when a client viewed their gallery but hasn't picked favorites yet.",
    subject: "Have you picked your favorites from {{gallery_name}}?",
    body: `Hi there,

We noticed you've had a look at your gallery “{{gallery_name}}”, we'd love to know which images you'd like us to focus on.

Open the gallery and tap the heart on your favorites: {{gallery_link}}

Warmly,
{{business_name}}`,
    tokens: ["{{gallery_name}}", "{{gallery_link}}", "{{business_name}}"],
  },
  {
    key: "CONTRACT_RESEND",
    name: "Contract signature reminder",
    description: "Sent by the contract-unsigned automation when a contract has been awaiting signature.",
    subject: "Reminder: your contract from {{business_name}} is awaiting signature",
    body: `Hi {{client_name}},

The contract “{{contract_title}}” is still waiting for your signature. It only takes a minute:

{{signing_link}}

If anything looks off, just reply and we'll sort it out.

{{business_name}}`,
    tokens: ["{{client_name}}", "{{contract_title}}", "{{signing_link}}", "{{business_name}}"],
  },
  {
    key: "GALLERY_EXPIRY",
    name: "Gallery expiry reminder",
    description: "Sent when a gallery with the expiry-reminder flag is close to expiring.",
    subject: "Your gallery “{{gallery_name}}” expires on {{expiry_date}}",
    body: `Hi there,

A quick heads-up: your gallery “{{gallery_name}}” will expire on {{expiry_date}}. After that it will no longer be available online.

Download your favorites before then: {{gallery_link}}

{{business_name}}`,
    tokens: ["{{gallery_name}}", "{{expiry_date}}", "{{gallery_link}}", "{{business_name}}"],
  },
  {
    key: "BOOKING_REMINDER",
    name: "Upcoming session reminder",
    description: "Sent ahead of a confirmed session.",
    subject: "See you soon, {{session_type}} on {{session_date}}",
    body: `Hi {{client_name}},

We're looking forward to your {{session_type}} on {{session_date}}.

Location: {{session_location}}

If you need to reschedule, let us know as early as you can.

{{business_name}}`,
    tokens: ["{{client_name}}", "{{session_type}}", "{{session_date}}", "{{session_location}}", "{{business_name}}"],
  },
];

export function defaultTemplate(key: string): EmailTemplateDef | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.key === key);
}

/** Effective template for a user: their custom edit if any, else the default. */
export async function getTemplate(userId: string, key: string): Promise<{ subject: string; body: string }> {
  const custom = await db.emailTemplate.findUnique({ where: { userId_key: { userId, key } } });
  if (custom) return { subject: custom.subject, body: custom.body };
  const def = defaultTemplate(key);
  return { subject: def?.subject ?? "", body: def?.body ?? "" };
}

export async function renderTemplate(
  userId: string,
  key: string,
  ctx: SmartFieldContext
): Promise<{ subject: string; body: string }> {
  const t = await getTemplate(userId, key);
  return {
    subject: renderSmartFields(t.subject, ctx),
    body: renderSmartFields(t.body, ctx),
  };
}
