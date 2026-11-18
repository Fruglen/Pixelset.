import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyScheduledSends, clientIp, logStudioMessage } from "@/lib/studio";
import { deliveryNote, sendMail } from "@/lib/mailer";

// Signed notice to the photographer's account email (real send when Resend is
// connected; the inbox log entry is kept either way).
async function notifyOwnerSigned(userId: string, title: string, signerName: string, fully: boolean) {
  const owner = await db.user.findUnique({ where: { id: userId } });
  if (!owner) return { sent: false } as const;
  return sendMail({
    userId,
    to: owner.email,
    subject: fully ? `Contract fully signed: ${title}` : `Contract signed (1 of 2): ${title}`,
    text: `${signerName} just signed "${title}".${fully ? "" : " The second signer still needs to sign."}

You can review the signature record in Studio Manager under Contracts.`,
  });
}

// Public e-sign endpoint: typed signature + timestamp + IP / user-agent capture.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  await applyScheduledSends(undefined, params.token);
  const contract = await db.contract.findUnique({
    where: { token: params.token },
    include: { contact: true },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.status === "DRAFT") return NextResponse.json({ error: "This contract is not open for signing yet." }, { status: 400 });
  if (contract.expiresAt && contract.expiresAt.getTime() < Date.now() && contract.status !== "SIGNED") {
    return NextResponse.json({ error: "This contract has expired." }, { status: 400 });
  }

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Type your full name to sign." }, { status: 400 });
  if (body.agree !== true) return NextResponse.json({ error: "You must agree to the terms to sign." }, { status: 400 });

  const ip = clientIp(req.headers);
  const userAgent = req.headers.get("user-agent") ?? "";
  const now = new Date();

  if (!contract.signedAt) {
    const complete = !contract.secondSignerEmail;
    await db.contract.update({
      where: { id: contract.id },
      data: {
        signerName: name,
        signedAt: now,
        signerIp: ip,
        signerUserAgent: userAgent,
        ...(complete ? { status: "SIGNED" } : {}),
      },
    });
    const notice = await notifyOwnerSigned(contract.userId, contract.title, name, complete);
    await logStudioMessage(contract.userId, {
      kind: "CONTRACT",
      name,
      email: contract.contact?.email ?? "",
      subject: complete ? `Contract signed: ${contract.title}` : `Contract signed (1 of 2): ${contract.title}`,
      body: `${name} signed “${contract.title}”, ${now.toLocaleString("en-US")} · IP ${ip}`,
      meta: [complete ? "" : `Awaiting second signer ${contract.secondSignerEmail}`, deliveryNote(notice)]
        .filter(Boolean)
        .join(" · "),
    });
    return NextResponse.json({ ok: true, complete });
  }

  // Second signature
  if (contract.secondSignerEmail && !contract.secondSignedAt) {
    await db.contract.update({
      where: { id: contract.id },
      data: {
        secondSignerName: name,
        secondSignedAt: now,
        secondSignerIp: ip,
        secondSignerUserAgent: userAgent,
        status: "SIGNED",
      },
    });
    const notice = await notifyOwnerSigned(contract.userId, contract.title, name, true);
    await logStudioMessage(contract.userId, {
      kind: "CONTRACT",
      name,
      email: contract.secondSignerEmail,
      subject: `Contract fully signed: ${contract.title}`,
      body: `${name} added the second signature on “${contract.title}”, ${now.toLocaleString("en-US")} · IP ${ip}`,
      meta: deliveryNote(notice),
    });
    return NextResponse.json({ ok: true, complete: true });
  }

  return NextResponse.json({ error: "This contract is already signed." }, { status: 400 });
}
