// Night build: recommended store pricing. Suggested retail prices drawn from
// typical professional lab costs (WHCC and Miller's style price lists) with
// the markup photographers commonly charge (roughly 3 to 4 times cost on
// prints, less on big wall art). Photographers can take a whole template into
// a price sheet and then adjust; nothing here overrides a price they set.

export interface RecommendedVariant {
  name: string;
  labCostCents: number;
  suggestedCents: number;
}

export interface RecommendedProduct {
  name: string;
  category: string;
  blurb: string;
  variants: RecommendedVariant[];
}

const v = (name: string, cost: number, price: number): RecommendedVariant => ({
  name,
  labCostCents: Math.round(cost * 100),
  suggestedCents: Math.round(price * 100),
});

export const RECOMMENDED_PRODUCTS: RecommendedProduct[] = [
  {
    name: "Prints",
    category: "PRINT",
    blurb: "Lustre prints, the everyday seller.",
    variants: [v("4x6", 0.6, 5), v("5x7", 1.1, 10), v("8x10", 2.2, 20), v("11x14", 4.5, 35), v("16x20", 9, 65), v("20x30", 16, 110)],
  },
  {
    name: "Canvas Gallery Wrap",
    category: "CANVAS",
    blurb: "1.5 inch gallery wrapped canvas.",
    variants: [v("11x14", 28, 95), v("16x20", 42, 140), v("20x30", 68, 210), v("24x36", 95, 290)],
  },
  {
    name: "Metal Print",
    category: "METAL",
    blurb: "Dye sublimation on aluminium, ready to hang.",
    variants: [v("11x14", 32, 110), v("16x20", 55, 175), v("20x30", 88, 260), v("24x36", 120, 350)],
  },
  {
    name: "Acrylic Print",
    category: "ACRYLIC",
    blurb: "Face mounted acrylic, gallery look.",
    variants: [v("11x14", 45, 150), v("16x20", 75, 230), v("20x30", 115, 340)],
  },
  {
    name: "Wood Print",
    category: "WOOD",
    blurb: "Printed on maple wood, natural edge.",
    variants: [v("11x14", 30, 100), v("16x20", 48, 155), v("20x30", 80, 240)],
  },
  {
    name: "Layflat Album",
    category: "ALBUM",
    blurb: "20 page layflat album, linen cover.",
    variants: [v("8x8", 65, 250), v("10x10", 85, 325), v("12x12", 110, 425)],
  },
  {
    name: "Photo Book",
    category: "ALBUM",
    blurb: "Hardcover press book, 20 pages.",
    variants: [v("8x10", 28, 95), v("11x14", 40, 130)],
  },
  {
    name: "Greeting Cards (set of 25)",
    category: "CARD",
    blurb: "Flat 5x7 cards with envelopes.",
    variants: [v("Flat 5x7", 18, 55), v("Folded 5x7", 24, 70)],
  },
  {
    name: "Digital Download",
    category: "DIGITAL",
    blurb: "The file itself, licensed for personal use.",
    variants: [v("Web size (2048px)", 0, 15), v("High resolution (3600px)", 0, 35), v("Full resolution original", 0, 75)],
  },
];

/** Suggested price for one known variant name within a category, if we have one. */
export function suggestedFor(category: string, variantName: string): RecommendedVariant | null {
  const p = RECOMMENDED_PRODUCTS.find((x) => x.category === category);
  if (!p) return null;
  return p.variants.find((x) => x.name.toLowerCase() === variantName.trim().toLowerCase()) ?? null;
}
