import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { planFor, tierLabel } from "@/lib/plans";
import { geminiConfigured } from "@/lib/gemini";
import { aiToolsConfigured } from "@/lib/ai-tools";
import EditorClient from "./editor-client";
import EditorAddonWall from "./editor-addon";

export const dynamic = "force-dynamic";

export default async function EditorPage() {
  const user = (await getCurrentUser())!;
  const plan = await planFor(user.id);

  // Night build (Photo Editor): the editor is the paid add on from the
  // research (about $12 a month stand alone). On the Free gallery plan it
  // sits behind the add on wall; every paid gallery plan includes it.
  // Night build (Pricing lane): the wall now activates the real add-on
  // state in the billing system (simulated while billing is parked), and
  // an account with the add-on active skips the wall.
  if (plan.gallery === "free" && !plan.billing.addOns.editor) {
    return <EditorAddonWall planLabel={tierLabel("gallery", plan.gallery)} />;
  }

  const collections = await db.collection.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      // The canvas editor works on images. Night build: RAW originals join
      // through their generated JPEG preview (edits save as JPEG copies,
      // the RAW file is never touched); RAW files without a preview and
      // videos stay out.
      photos: {
        where: { OR: [{ mediaType: "IMAGE" }, { mediaType: "RAW", posterUrl: { not: "" } }] },
        orderBy: { order: "asc" },
        select: { id: true, url: true, filename: true, setId: true, mediaType: true, posterUrl: true },
      },
      // Phase 5B: every collection and set is a possible export destination
      sets: { orderBy: { order: "asc" }, select: { id: true, name: true } },
    },
  });

  return (
    <EditorClient
      aiConnected={geminiConfigured()}
      aiToolsConnected={aiToolsConfigured()}
      collections={collections
        .filter((c) => c.photos.length > 0)
        .map((c) => ({
          id: c.id,
          name: c.name,
          photos: c.photos.map((p) => ({
            id: p.id,
            url: p.mediaType === "RAW" ? p.posterUrl : p.url,
            filename: p.filename,
            setId: p.setId,
            raw: p.mediaType === "RAW",
          })),
        }))}
      destinations={collections.map((c) => ({ id: c.id, name: c.name, sets: c.sets }))}
    />
  );
}
