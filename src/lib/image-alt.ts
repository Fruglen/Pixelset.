import { blockDef, collectImages, type Block } from "./blocks";

// Night build (Website): server side alt text helpers for the AI alt text
// generator. Collection reuses the SEO audit's own walker (same path
// format: a field key, or "listKey.index" for images inside list items);
// this module adds the matching write back plus the basic suggestion used
// while AI is not connected.

export type ImageRef = ReturnType<typeof collectImages>[number];

export const collectImageRefs = collectImages;

export function setImageAlt(blocks: Block[], ref: ImageRef, alt: string): Block[] {
  return blocks.map((block) => {
    if (block.id !== ref.blockId) return block;
    const def = blockDef(block.type);
    if (!def) return block;
    if (!ref.path.includes(".")) {
      const altKey = ref.path === "image" ? "imageAlt" : `${ref.path}Alt`;
      return { ...block, props: { ...block.props, [altKey]: alt } };
    }
    const [listKey, idxStr] = ref.path.split(".");
    const idx = parseInt(idxStr, 10);
    const field = def.fields.find((f) => f.key === listKey);
    const imgField = field?.fields?.find((sf) => sf.kind === "image");
    if (!field || !imgField) return block;
    const altKey = imgField.key === "image" ? "imageAlt" : imgField.key === "url" ? "alt" : `${imgField.key}Alt`;
    const items = Array.isArray(block.props[listKey]) ? [...(block.props[listKey] as Record<string, unknown>[])] : [];
    if (!items[idx]) return block;
    items[idx] = { ...items[idx], [altKey]: alt };
    return { ...block, props: { ...block.props, [listKey]: items } };
  });
}

/** A clearly basic, non AI suggestion from the filename and context. Used
 *  only while the Gemini key is not connected, and labelled as basic. */
export function basicAltSuggestion(url: string, context: string): string {
  const file = decodeURIComponent(url.split("/").pop() ?? "").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  const words = file.replace(/\b(img|image|photo|pxs|upload|final|edit|copy|\d+)\b/gi, "").replace(/\s+/g, " ").trim();
  const base = words.length >= 3 ? words : context;
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "Photograph";
}
