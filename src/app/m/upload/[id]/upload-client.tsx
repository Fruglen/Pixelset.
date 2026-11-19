"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { UPLOAD_LIMITS_TEXT, clientLimitError, uploadOne, type QueueItem } from "@/lib/upload-client";

export default function MobileUploadClient({
  collection,
  sets,
}: {
  collection: { id: string; name: string };
  sets: { id: string; name: string; count: number }[];
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [setId, setSetId] = useState(sets[0]?.id ?? "");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);

  async function handle(files: FileList | null) {
    const list = files ? Array.from(files) : [];
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
    if (list.length === 0 || !setId) return;
    const setName = sets.find((s) => s.id === setId)?.name ?? "";
    const stamp = Date.now();
    const items: QueueItem[] = list.map((f, i) => ({ key: `${stamp}-${i}`, name: f.name || "photo.jpg", size: f.size, setName, status: "queued", progress: 0 }));
    setQueue((q) => [...items, ...q]);
    setBusy(true);
    const patch = (key: string, d: Partial<QueueItem>) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...d } : x)));
    for (let i = 0; i < list.length; i++) {
      const pre = clientLimitError(list[i]);
      if (pre) {
        patch(items[i].key, { status: "error", error: pre });
        continue;
      }
      patch(items[i].key, { status: "uploading" });
      const err = await uploadOne(collection.id, setId, list[i], (pct) => patch(items[i].key, { progress: pct }));
      patch(items[i].key, err ? { status: "error", error: err } : { status: "done", progress: 100 });
    }
    setBusy(false);
  }

  const done = queue.filter((q) => q.status === "done").length;

  return (
    <div className="min-h-screen bg-paper px-4 py-6 max-w-md mx-auto">
      <Link href={`/collections/${collection.id}`} className="text-xs text-neutral-500 underline">
        Open in the dashboard
      </Link>
      <h1 className="font-display text-2xl mt-2">{collection.name}</h1>
      <p className="text-sm text-neutral-500 mb-5">Upload from this phone</p>

      <label className="label">Add to set</label>
      <select className="input mb-5" value={setId} onChange={(e) => setSetId(e.target.value)}>
        {sets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.count})
          </option>
        ))}
      </select>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handle(e.target.files)} />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*,video/mp4,video/quicktime,.mov,.mp4,.m4v"
        multiple
        className="hidden"
        onChange={(e) => handle(e.target.files)}
      />
      <div className="grid grid-cols-1 gap-3">
        <button className="btn-primary !py-4 text-base" onClick={() => cameraRef.current?.click()} disabled={!setId}>
          Take a photo
        </button>
        <button className="btn-secondary !py-4 text-base" onClick={() => libraryRef.current?.click()} disabled={!setId}>
          Choose from camera roll
        </button>
      </div>
      <p className="text-[11px] text-neutral-400 mt-3">Limits: {UPLOAD_LIMITS_TEXT}.</p>

      {queue.length > 0 && (
        <div className="card p-4 mt-6">
          <p className="text-sm font-medium mb-2">
            {done} uploaded{busy ? ", uploading…" : ""}
          </p>
          <ul className="space-y-2">
            {queue.map((q) => (
              <li key={q.key} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{q.name}</span>
                  <span className={q.status === "done" ? "text-emerald-600" : q.status === "error" ? "text-red-600" : "text-neutral-500"}>
                    {q.status === "done" ? "Uploaded" : q.status === "error" ? "Failed" : q.status === "uploading" ? `${q.progress}%` : "Waiting"}
                  </span>
                </div>
                {q.status === "uploading" && (
                  <div className="h-1 bg-neutral-100 rounded mt-1">
                    <div className="h-1 bg-neutral-900 rounded" style={{ width: `${q.progress}%` }} />
                  </div>
                )}
                {q.error && <p className="text-red-600 mt-0.5">{q.error}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
