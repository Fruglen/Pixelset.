import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { logStudioMessage } from "@/lib/studio";
import { syncBookingToGoogle } from "@/lib/google-calendar";
import { sendBookingConfirmation, sendStudioEmail, sessionDateLabel } from "@/lib/studio-flow";
import { absoluteUrl } from "@/lib/mailer";

// Phase 5B platform: approve or decline a booking request held for manual
// approval (Studio Manager Pro). Approving either confirms the booking, or,
// when a contract or retainer is still outstanding, moves it to Awaiting Client
// and emails the client their link to sign and pay (payments mocked per the
// owner's payments exclusion). Declining cancels it and tells the client.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await db.booking.findFirst({
    where: { id: params.id, userId: user.id },
    include: { contact: true, contract: true, response: true, sessionType: { select: { questionnaireId: true } } },
  });
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (b.approvalState !== "REQUESTED") return NextResponse.json({ error: "This booking is not waiting for approval" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  const business = user.businessName || user.name;
  const who = b.contact?.name ?? "";

  if (body.decision === "decline") {
    await db.booking.update({ where: { id: b.id }, data: { status: "CANCELLED", approvalState: "DECLINED" } });
    await syncBookingToGoogle(b.id);
    let delivery = "No client email on file";
    if (b.contact?.email) {
      delivery = await sendStudioEmail(
        user.id,
        { email: b.contact.email, name: who },
        `About your booking request: ${b.title}`,
        `Hi ${who},\n\nThank you for your request for ${b.title} on ${sessionDateLabel(b.startsAt)}. Unfortunately we are not able to take this booking.${message ? `\n\n${message}` : ""}\n\n${business}`,
        "Booking request declined"
      );
    }
    return NextResponse.json({ ok: true, status: "CANCELLED", delivery });
  }

  if (body.decision !== "approve") return NextResponse.json({ error: "Choose approve or decline" }, { status: 400 });

  const outstanding: string[] = [];
  if (b.sessionType?.questionnaireId && !b.response) outstanding.push("answer the questionnaire");
  if (b.contract && b.contract.status !== "SIGNED") outstanding.push("sign the contract");
  if (b.retainerCents > 0 && b.paymentStatus === "UNPAID") outstanding.push("pay the retainer");
  const status = outstanding.length ? "AWAITING_CLIENT" : "CONFIRMED";
  await db.booking.update({ where: { id: b.id }, data: { status, approvalState: "APPROVED" } });
  await syncBookingToGoogle(b.id);
  if (b.contactId) await db.contact.update({ where: { id: b.contactId }, data: { state: "CLIENT" } }).catch(() => null);

  const project = await db.project.findUnique({ where: { bookingId: b.id } });
  if (!project) {
    const max = await db.project.aggregate({ where: { userId: user.id, stage: "BOOKED" }, _max: { order: true } });
    await db.project.create({
      data: {
        userId: user.id,
        name: who ? `${who}, ${b.title}` : b.title,
        contactId: b.contactId,
        bookingId: b.id,
        stage: "BOOKED",
        order: (max._max.order ?? 0) + 1,
      },
    });
  }

  let delivery = "No client email on file";
  if (status === "CONFIRMED") {
    delivery = await sendBookingConfirmation(b.id);
  } else if (b.contact?.email) {
    delivery = await sendStudioEmail(
      user.id,
      { email: b.contact.email, name: who },
      `Your booking is approved: ${b.title}`,
      `Hi ${who},\n\nGood news, your request for ${b.title} on ${sessionDateLabel(b.startsAt)} is approved.${message ? `\n\n${message}` : ""}\n\nTo lock in your date, please ${outstanding.join(" and ")} here:\n${absoluteUrl(`/book/manage/${b.clientToken ?? ""}`)}\n\n${business}`,
      "Booking approved"
    );
  }
  await logStudioMessage(user.id, {
    kind: "BOOKING",
    name: who,
    email: b.contact?.email ?? "",
    subject: `Booking request approved: ${b.title}`,
    body: status === "CONFIRMED" ? "Approved and confirmed." : `Approved, waiting for the client to ${outstanding.join(" and ")}.`,
  });
  return NextResponse.json({ ok: true, status, delivery });
}
