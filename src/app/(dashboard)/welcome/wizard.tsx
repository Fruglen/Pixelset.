"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UPLOAD_LIMITS_TEXT, clientLimitError, uploadOne } from "@/lib/upload-client";

export default function WelcomeWizard({
  name,
  businessName: initialBusiness,
  timezone: initialTz,
  timezones,
}: {
  name: string;
  businessName: string;
  timezone: string;
  timezones: string[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState(initialBusiness);
  const [timezone, setTimezone] = useState(initialTz);
  const [galleryName, setGalleryName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [created, setCreated] = useState<{ id: string; slug: string; setId: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState(0);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);

  async function saveStudio() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName, timezone, watermarkText: businessName || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Could not save");
      return;
    }
    setStep(2);
  }

  async function createGallery(e: React.FormEvent) {
    e.preventDefault();
    if (!galleryName.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: galleryName.trim(), eventDate: eventDate || null }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(d.error || "Could not create the gallery");
      return;
    }
    setBusy(false);
    setCreated({ id: d.id, slug: d.slug, setId: d.setId ?? "" });
    setStep(3);
  }

  async function upload(files: FileList | File[] | null) {
    if (!files || !created?.setId) return;
    const list = Array.from(files);
    setBusy(true);
    for (const f of list) {
      const pre = clientLimitError(f);
      const err = pre ?? (await uploadOne(created.id, created.setId, f, () => {}));
      if (err) setUploadErrors((x) => [...x, err]);
      else setUploaded((n) => n + 1);
    }
    setBusy(false);
  }

  async function finish() {
    await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ onboarded: true }) });
    router.push(created ? `/collections/${created.id}` : "/collections");
    router.refresh();
  }

  const steps = ["Your studio", "First gallery", "Add photos"];

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="font-display text-3xl mb-1">Welcome to Pixora, {name.split(" ")[0]}</h1>
      <p className="text-sm text-neutral-500 mb-6">Your free account is ready, no card needed. Let’s set up your first client gallery.</p>
      <ol className="flex gap-4 mb-6 text-xs">
        {steps.map((label, i) => (
          <li key={label} className={`flex items-center gap-2 ${step === i + 1 ? "text-neutral-900 font-medium" : "text-neutral-400"}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center border ${step > i + 1 ? "bg-neutral-900 text-white border-neutral-900" : "border-current"}`}>
              {step > i + 1 ? "✓" : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="card p-6 space-y-4">
          <div>
            <label className="label">Business name (shown on your galleries)</label>
            <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Studio name" />
          </div>
          <div>
            <label className="label">Your timezone (gallery expiry runs on it)</label>
            <select className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-between">
            <button className="text-xs text-neutral-500 underline" onClick={finish}>
              Skip setup
            </button>
            <button className="btn-primary" onClick={saveStudio} disabled={busy}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={createGallery} className="card p-6 space-y-4">
          <div>
            <label className="label">Gallery name</label>
            <input className="input" value={galleryName} onChange={(e) => setGalleryName(e.target.value)} placeholder="e.g. Emma and James Wedding" autoFocus required />
          </div>
          <div>
            <label className="label">Event date (optional)</label>
            <input className="input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button className="btn-primary" disabled={busy}>
              {busy ? "Creating…" : "Create gallery"}
            </button>
          </div>
        </form>
      )}

      {step === 3 && created && (
        <div className="card p-6 space-y-4">
          <p className="text-sm">
            Gallery created at <span className="font-mono">/g/{created.slug}</span>. Add a few photos now, or do it later from the Photos tab.
          </p>
          <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={(e) => upload(e.target.files)} />
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              upload(e.dataTransfer.files);
            }}
            className={`rounded-lg border-2 border-dashed p-8 text-center cursor-pointer ${drag ? "border-neutral-900 bg-neutral-100" : "border-neutral-300"}`}
          >
            <p className="text-sm font-medium">{busy ? "Uploading…" : "Drag photos here or click to choose"}</p>
            <p className="text-[11px] text-neutral-400 mt-1">{UPLOAD_LIMITS_TEXT}</p>
          </div>
          {uploaded > 0 && <p className="text-sm text-emerald-600">{uploaded} photo{uploaded === 1 ? "" : "s"} uploaded.</p>}
          {uploadErrors.map((e) => (
            <p key={e} className="text-xs text-red-600">
              {e}
            </p>
          ))}
          <div className="flex justify-end">
            <button className="btn-primary" onClick={finish} disabled={busy}>
              {uploaded > 0 ? "Open my gallery" : "Finish, open my gallery"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
