import type { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

// Phase 5B seed data for the website section:
// - a Flex canvas block on the About page (free positioned text, image, shape, button)
// - the demo custom domain in the honest "waiting for DNS" state with its TXT token
// - the site published, so the live snapshot matches the seeded draft
export async function seed(db: PrismaClient, userId: string) {
  const website = await db.website.findUnique({ where: { userId } });
  if (!website) return;

  const about = await db.sitePage.findFirst({ where: { websiteId: website.id, type: "ABOUT" } });
  if (about) {
    const blocks = JSON.parse(about.blocks) as { id: string; type: string; props: Record<string, unknown> }[];
    if (!blocks.some((b) => b.type === "freeform")) {
      blocks.splice(1, 0, {
        id: "bseedflex1",
        type: "freeform",
        props: {
          height: 520,
          _anchor: "studio-notes",
          elements: [
            { id: "eshape1", kind: "shape", x: 52, y: 8, w: 40, h: 78, rotate: 0, z: 0, shape: "rect", fill: "muted", radius: 0, opacity: 1 },
            { id: "eimg1", kind: "image", x: 58, y: 14, w: 30, h: 66, rotate: 2, z: 2, url: "/api/placeholder?w=900&h=1200&hue=36&label=Studio&variant=portrait", alt: "The studio window light" },
            { id: "etext1", kind: "text", x: 6, y: 16, w: 42, h: 30, z: 3, text: "Made by hand, [color=accent]printed to last[/color]", fontSize: 54, align: "left", font: "display" },
            { id: "etext2", kind: "text", x: 6, y: 50, w: 38, h: 18, z: 3, text: "Every gallery is edited twice and delivered once, finished.", fontSize: 18, align: "left", font: "body", color: "subtle" },
            { id: "ebtn1", kind: "button", x: 6, y: 74, w: 20, h: 10, z: 3, text: "Start an inquiry", link: "/contact", variant: "solid" },
            { id: "ecircle1", kind: "shape", x: 85, y: 70, w: 9, h: 18, rotate: 0, z: 3, shape: "circle", fill: "accent", opacity: 0.85 },
          ],
        },
      });
      await db.sitePage.update({ where: { id: about.id }, data: { blocks: JSON.stringify(blocks) } });
    }
  }

  await db.website.update({
    where: { id: website.id },
    data: {
      domainStatus: website.customDomain ? "PENDING" : "NONE",
      domainToken: website.customDomain ? website.domainToken || randomBytes(9).toString("hex") : "",
      domainNote: website.customDomain ? "No DNS records found yet. DNS changes can take up to 48 hours to spread." : "",
    },
  });

  // Publish: snapshot the seeded draft as the live site.
  const fresh = await db.website.findUniqueOrThrow({ where: { id: website.id } });
  const pages = await db.sitePage.findMany({ where: { websiteId: website.id }, orderBy: { order: "asc" } });
  const keys = ["template", "palette", "fontTheme", "headerStyle", "logoText", "logoUrl", "tagline", "footerText", "socialInstagram", "socialFacebook", "socialPinterest", "spacing", "buttonShape", "arrowStyle"] as const;
  const design = Object.fromEntries(keys.map((k) => [k, String(fresh[k] ?? "")]));
  const snapshot = {
    version: 1,
    design,
    pages: pages.map((p) => ({ id: p.id, type: p.type, title: p.title, slug: p.slug, order: p.order, visible: p.visible, blocks: p.blocks, seoTitle: p.seoTitle, seoDescription: p.seoDescription })),
  };
  await db.website.update({ where: { id: website.id }, data: { publishedSnapshot: JSON.stringify(snapshot), publishedAt: new Date() } });
}
