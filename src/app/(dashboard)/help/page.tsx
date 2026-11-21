import HelpClient from "./help-client";

export const metadata = { title: "Help centre" };

// Fix batch 2026-11-20: in app help centre (guides live in src/lib/help-guides.ts).
export default function HelpPage({ searchParams }: { searchParams: { q?: string } }) {
  return (
    <div>
      <h1 className="font-display text-2xl mb-1">Help centre</h1>
      <p className="text-sm text-neutral-500 mb-5">
        Short guides to every part of Pixora. Search, or browse by product. Still stuck? Use the Support button at the
        bottom right of the page.
      </p>
      <HelpClient initialQuery={typeof searchParams.q === "string" ? searchParams.q : ""} />
    </div>
  );
}
