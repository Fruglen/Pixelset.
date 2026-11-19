"use client";

/* eslint-disable @next/next/no-img-element */

export interface Branding {
  brandLogoUrl: string;
  brandColor: string;
  headerImageUrl: string;
}

// Phase 5B: contract branding (logo, brand colour, header image) with a live preview
// of how the client facing document header will look.
export function BrandingFields({
  value,
  onChange,
  note,
  disabled = false,
}: {
  value: Branding;
  onChange: (v: Branding) => void;
  note?: string;
  disabled?: boolean;
}) {
  const color = /^#[0-9a-fA-F]{6}$/.test(value.brandColor) ? value.brandColor : "";
  return (
    <div className="border border-neutral-200 rounded-md p-4 space-y-3">
      <p className="text-sm font-medium">Branding</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Logo image URL</label>
          <input
            className="input"
            disabled={disabled}
            placeholder="https://..."
            value={value.brandLogoUrl}
            onChange={(e) => onChange({ ...value, brandLogoUrl: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Header image URL</label>
          <input
            className="input"
            disabled={disabled}
            placeholder="https://..."
            value={value.headerImageUrl}
            onChange={(e) => onChange({ ...value, headerImageUrl: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Brand colour</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              disabled={disabled}
              className="h-9 w-12 rounded border border-neutral-300"
              value={color || "#1c1c1c"}
              onChange={(e) => onChange({ ...value, brandColor: e.target.value })}
            />
            <input
              className="input"
              disabled={disabled}
              placeholder="#1c1c1c"
              value={value.brandColor}
              onChange={(e) => onChange({ ...value, brandColor: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className="rounded-sm border border-neutral-200 bg-[#faf9f7] overflow-hidden" style={color ? { borderTop: `4px solid ${color}` } : undefined}>
        {value.headerImageUrl ? <img src={value.headerImageUrl} alt="" className="w-full h-24 object-cover" /> : null}
        <div className="py-3 text-center">
          {value.brandLogoUrl ? <img src={value.brandLogoUrl} alt="Logo preview" className="mx-auto max-h-10 object-contain" /> : null}
          <p className="text-[10px] uppercase tracking-[0.25em] mt-1" style={color ? { color } : { color: "#a3a3a3" }}>
            Document preview
          </p>
        </div>
      </div>
      {note ? <p className="text-xs text-neutral-400">{note}</p> : null}
    </div>
  );
}
