import type { Brand } from "@/lib/brand";

// Phase 5B platform: the account brand (logo or name in the brand heading font
// and colour) shown at the top of every client facing document page.
export function BrandMark({ brand, align = "center", size = "md" }: { brand: Brand; align?: "center" | "left"; size?: "sm" | "md" }) {
  const box = align === "center" ? "flex flex-col items-center text-center" : "flex flex-col items-start";
  return (
    <div className={box} data-brand-mark>
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logoUrl}
          alt={`${brand.name} logo`}
          className={`${size === "sm" ? "max-h-9" : "max-h-14"} max-w-[220px] object-contain`}
        />
      ) : (
        <span
          className={size === "sm" ? "text-lg" : "text-2xl"}
          style={{ fontFamily: brand.display, color: brand.custom ? brand.color : undefined }}
        >
          {brand.name}
        </span>
      )}
    </div>
  );
}

/** A thin brand coloured rule used at the top of documents. */
export function BrandRule({ brand }: { brand: Brand }) {
  return <div className="h-1 w-full rounded-full" style={{ background: brand.custom ? brand.color : "transparent" }} />;
}
