import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  clearEmailChallenge,
  confirmEmailChallenge,
  createEmailChallenge,
  readGalleryAccess,
  withEmailVerified,
  writeGalleryAccess,
} from "@/lib/gallery-auth";
import { needsEmailVerification } from "@/lib/gallery-verify";
import { sendMail } from "@/lib/mailer";
import { logActivity } from "@/lib/activity";
import { upsertContact } from "@/lib/contact-sync";
import { clearFailures, rateLimitKey, recordFailure, retryAfterSeconds, tooManyAttempts } from "@/lib/rate-limit";

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const collection = await db.collection.findUnique({
    where: { slug: params.slug },
    include: { sets: true },
  });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const mode = body.mode as string;
  const access = readGalleryAccess(collection.id);

  // GLE-118: password, access code, and exclusive-set attempts share one key
  // per IP + gallery. Check and record run with no await between them.
  // A success here deliberately does NOT clear earlier failures: a gallery has
  // several credentials, so someone holding one valid code could otherwise
  // reset the counter between guesses at the others. Failures age out instead.
  const attemptKey = rateLimitKey("gallery-unlock", req.headers, collection.id);

  if (mode === "password") {
    const passwordOk = typeof body.password === "string" && body.password === collection.password;
    // Phase 5B platform: an access group code also opens a protected gallery.
    const code = !passwordOk && typeof body.password === "string" ? body.password.trim() : "";
    const group = code ? await db.accessGroup.findFirst({ where: { collectionId: collection.id, code } }) : null;
    const retryAfter = retryAfterSeconds(attemptKey);
    if (retryAfter > 0) return tooManyAttempts(retryAfter);
    if (!passwordOk) {
      if (!group) {
        recordFailure(attemptKey);
        return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
      }
      const sets = Array.from(new Set([...access.sets, ...group.setIds.split(",").filter(Boolean)]));
      writeGalleryAccess(collection.id, { ...access, pw: true, sets, group: group.id });
      await logActivity(collection.id, "ACCESS_GROUP", `Entered as ${group.name}`, access.email);
      return NextResponse.json({ ok: true, group: group.name });
    }
    writeGalleryAccess(collection.id, { ...access, pw: true });
    return NextResponse.json({ ok: true });
  }

  if (mode === "email" || mode === "identify" || mode === "prerelease") {
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const existing = await db.emailRegistration.findUnique({
      where: { collectionId_email: { collectionId: collection.id, email } },
    });
    if (!existing) {
      await db.emailRegistration.create({ data: { collectionId: collection.id, email } });
      await logActivity(
        collection.id,
        "EMAIL_REGISTRATION",
        mode === "prerelease" ? "Registered for pre-release notification" : "Registered to view gallery",
        email
      );
    }
    // Phase 5B: gallery clients become Studio contacts; optional marketing opt in
    await upsertContact(collection.userId, email, name, "GALLERY", { tag: "gallery client", makeClient: true });
    if (body.optIn === true && collection.campaignOptIn) {
      // The campaign audience: opt ins are stored per gallery and the contact is
      // tagged so the address can be picked as a campaign recipient source.
      await upsertContact(collection.userId, email, name, "GALLERY", { tag: "marketing opt in" });
      await db.campaignOptIn.upsert({
        where: { collectionId_email: { collectionId: collection.id, email } },
        update: { name: name || undefined },
        create: { collectionId: collection.id, email, name },
      });
      await logActivity(collection.id, "MARKETING_OPT_IN", "Opted in to marketing emails", email);
    }
    if (mode === "prerelease") return NextResponse.json({ ok: true });
    // GLE-122: changing the typed email drops any ownership held under the old one.
    const sameEmail = email === access.email;
    const next = { ...access, email, name, lists: sameEmail ? access.lists : [], verified: sameEmail ? access.verified : "" };
    writeGalleryAccess(collection.id, next);
    return NextResponse.json({ ok: true, needsVerification: await needsEmailVerification(collection.id, next) });
  }

  // GLE-122 (H7): email the current identity a one-time code. Only addresses that
  // would gain ownership get mail, so this cannot be used to send to anyone.
  if (mode === "verify-request") {
    if (!access.email) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    if (!(await needsEmailVerification(collection.id, access))) {
      return NextResponse.json({ ok: true, required: false });
    }
    // Two limits: per sender, and per recipient so many IPs cannot flood one inbox.
    // No await between check and record.
    const senderKey = rateLimitKey("gallery-verify-send", req.headers, collection.id);
    const inboxKey = rateLimitKey("gallery-verify-inbox", new Headers(), access.email);
    const retryAfter = Math.max(retryAfterSeconds(senderKey), retryAfterSeconds(inboxKey));
    if (retryAfter > 0) return tooManyAttempts(retryAfter);
    recordFailure(senderKey);
    recordFailure(inboxKey);
    const code = createEmailChallenge(collection.id, access.email);
    const mail = await sendMail({
      userId: collection.userId,
      to: access.email,
      subject: `Your code for ${collection.name}`,
      text: `Your confirmation code is ${code}\n\nEnter it in the gallery "${collection.name}" to open your favorites and downloads. It expires in 10 minutes and only works in the browser where you asked for it.\n\nIf you did not ask for this, you can ignore this email.`,
    });
    if (!mail.sent) {
      clearEmailChallenge(collection.id);
      return NextResponse.json({ error: "We could not send the code. Please contact your photographer." }, { status: 503 });
    }
    return NextResponse.json({ ok: true, required: true });
  }

  if (mode === "verify-confirm") {
    const code = typeof body.code === "string" ? body.code : "";
    const confirmKey = rateLimitKey("gallery-verify", req.headers, `${collection.id}\n${access.email}`);
    // No await between check, verify, and record.
    const retryAfter = retryAfterSeconds(confirmKey);
    if (retryAfter > 0) return tooManyAttempts(retryAfter);
    if (!confirmEmailChallenge(collection.id, access.email, code)) {
      recordFailure(confirmKey);
      return NextResponse.json({ error: "That code is not valid or has expired" }, { status: 401 });
    }
    clearFailures(confirmKey);
    clearEmailChallenge(collection.id);
    writeGalleryAccess(collection.id, withEmailVerified(collection.id, access));
    await logActivity(collection.id, "EMAIL_VERIFIED", "Confirmed their email with a code", access.email);
    return NextResponse.json({ ok: true });
  }

  if (mode === "exclusive") {
    const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const retryAfter = retryAfterSeconds(attemptKey);
    if (retryAfter > 0) return tooManyAttempts(retryAfter);
    const matching = collection.sets.filter(
      (s) => s.clientExclusive && s.clientEmail === email && s.clientPassword === password
    );
    if (matching.length === 0) {
      recordFailure(attemptKey);
      return NextResponse.json({ error: "No exclusive sets match that email and password" }, { status: 401 });
    }
    const sets = Array.from(new Set([...access.sets, ...matching.map((s) => s.id)]));
    writeGalleryAccess(collection.id, { ...access, email: access.email || email, sets });
    return NextResponse.json({ ok: true, unlocked: matching.length });
  }

  if (mode === "group") {
    // Phase 5B: per viewer access groups (vendors, second shooters, family)
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const group = code
      ? await db.accessGroup.findFirst({ where: { collectionId: collection.id, code } })
      : null;
    const retryAfter = retryAfterSeconds(attemptKey);
    if (retryAfter > 0) return tooManyAttempts(retryAfter);
    if (!group) {
      recordFailure(attemptKey);
      return NextResponse.json({ error: "That access code is not valid for this gallery" }, { status: 401 });
    }
    const groupSets = group.setIds.split(",").filter(Boolean);
    const sets = Array.from(new Set([...access.sets, ...groupSets]));
    writeGalleryAccess(collection.id, { ...access, pw: true, sets, group: group.id });
    await logActivity(collection.id, "ACCESS_GROUP", `Entered as ${group.name}`, access.email);
    return NextResponse.json({ ok: true, group: group.name });
  }

  return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
}
