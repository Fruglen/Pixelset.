"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PALETTES, FONT_PAIRINGS, COVER_STYLES } from "@/lib/design";
import { EmptyState } from "@/components/empty-state";
import { ImagesIcon } from "@/components/icons";

export default function PresetsClient({
  presets,
}: {
  presets: { id: string; name: string; settings: string }[];
}) {
  const router = useRouter();

  async function rename(id: string, current: string) {
    const name = prompt("Preset name:", current);
    if (!name || name === current) return;
    await fetch(`/api/presets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this preset?")) return;
    await fetch(`/api/presets/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/collections" className="text-xs text-neutral-500 hover:underline">
            ← Collections
          </Link>
          <h1 className="font-display text-2xl mt-1">Collection Presets</h1>
          <p className="text-sm text-neutral-500">
            Save a collection’s Design, Privacy, Download and Expiry settings as a preset, then apply it
            when creating a new collection. Create one from any collection via Settings → “Save as
            Preset”.
          </p>
        </div>
      </div>

      {presets.length === 0 ? (
        <EmptyState icon={ImagesIcon} line="No presets yet. Open a collection's settings and press Save as Preset." ctaLabel="Open collections" ctaHref="/collections" />
      ) : (
        <div className="space-y-3">
          {presets.map((p) => {
            let s: Record<string, unknown> = {};
            try {
              s = JSON.parse(p.settings);
            } catch {}
            const palette = PALETTES.find((x) => x.id === s.palette);
            const font = FONT_PAIRINGS.find((x) => x.id === s.fontPairing);
            const cover = COVER_STYLES.find((x) => x.id === s.coverStyle);
            return (
              <div key={p.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {palette && (
                    <span
                      className="h-8 w-8 rounded-full border border-neutral-200"
                      style={{ background: palette.accent }}
                    />
                  )}
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-neutral-500">
                      {[
                        cover ? `Cover: ${cover.name}` : null,
                        font ? `Type: ${font.name}` : null,
                        palette ? `Palette: ${palette.name}` : null,
                        s.downloadEnabled === false ? "Downloads off" : null,
                        s.pinEnabled ? "PIN required" : null,
                        s.emailRegistration ? "Email gate" : null,
                        s.watermark ? "Watermarked" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary !py-1" onClick={() => rename(p.id, p.name)}>
                    Rename
                  </button>
                  <button className="btn-danger !py-1" onClick={() => remove(p.id)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
