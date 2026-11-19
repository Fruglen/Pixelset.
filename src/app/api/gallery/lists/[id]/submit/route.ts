import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readGalleryAccess } from "@/lib/gallery-auth";
import { getCurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notify";
import { deliveryNote, sendMail, absoluteUrl } from "@/lib/mailer";

// Phase 5B: the client marks a favorite list finished ("I'm done") and the
// photographer is notified (dashboard notification, Studio inbox entry, and an
// email to the account address when an email service is connected).
// DELETE reopens a submitted list (photographer only, from the dashboard).

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const list = await db.favoriteList.findUnique({
    where: { id: params.id },
    include: { favorites: { include: { photo: true } }, collection: { include: { user: true } } },
  });
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = readGalleryAccess(list.collectionId);
  if (!access.email || access.email !== list.clientEmail) {
    return NextResponse.json({ error: "This list belongs to another client" }, { status: 403 });
  }
  if (list.favorites.length === 0) return NextResponse.json({ error: "Add at least one photo first" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const note = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  await db.favoriteList.update({ where: { id: list.id }, data: { submittedAt: new Date() } });
  const c = list.collection;
  const who = list.clientName || list.clientEmail;
  const href = `/collections/${c.id}/activities?filter=favorites`;
  const filenames = list.favorites.map((f) => f.photo.filename).join(", ");
  await logActivity(c.id, "LIST_SUBMITTED", `“${list.name}” sent to the photographer (${list.favorites.length} photos)${note ? `: ${note}` : ""}`, list.clientEmail);
  await notify(c.userId, "LIST_SUBMITTED", `${who} finished “${list.name}”`, `${list.favorites.length} photos in ${c.name}`, href);
  const mail = await sendMail({
    userId: c.userId,
    to: c.user.email,
    subject: `${who} finished their favorites in ${c.name}`,
    text: `${who} marked the list "${list.name}" as done (${list.favorites.length} photos).\n\n${note ? `Message: ${note}\n\n` : ""}Filenames: ${filenames}\n\nOpen it: ${absoluteUrl(href)}`,
  });
  await db.studioMessage.create({
    data: {
      userId: c.userId,
      kind: "FAVORITES",
      name: who,
      email: list.clientEmail,
      subject: `Favorite list finished: ${list.name} (${c.name})`,
      body: `${list.favorites.length} photos.${note ? `\n\n${note}` : ""}\n\n${filenames}`,
      meta: deliveryNote(mail),
    },
  });
  return NextResponse.json({ ok: true });
}

// Photographer reopens a submitted list so the client can change their picks.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const list = await db.favoriteList.findFirst({ where: { id: params.id, collection: { userId: user.id } } });
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.favoriteList.update({ where: { id: list.id }, data: { submittedAt: null } });
  await logActivity(list.collectionId, "LIST_REOPENED", `“${list.name}” reopened for changes`, list.clientEmail);
  return NextResponse.json({ ok: true });
}
