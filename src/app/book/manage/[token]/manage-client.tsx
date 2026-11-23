"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/signature-pad";

interface QField {
  id: string;
  type: string;
  label: string;
  options: string;
  required: boolean;
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Phase 5B: client steps for an Awaiting Client booking.
export function ManageClient({
  token,
  questionnaire,
  contract,
  payment,
}: {
  token: string;
  questionnaire: { name: string; fields: QField[] } | null;
  contract: { token: string; title: string; body: string } | null;
  payment: { cents: number } | null;
  payMethods: { stripe: boolean; paypal: boolean; manual: boolean };
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [signName, setSignName] = useState("");
  const [mode, setMode] = useState<"type" | "draw">("type");
  const [drawn, setDrawn] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function post(data: Record<string, unknown>, url = `/api/book/manage/${token}`) {
    setError("");
    setBusy(true);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(out.error ?? "Something went wrong.");
      return false;
    }
    router.refresh();
    return true;
  }

  const next = questionnaire ? "questionnaire" : contract ? "contract" : payment ? "payment" : "confirm";

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">Your photographer reserved this time for you. Finish the steps below to confirm it.</p>
      {error ? <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p> : null}

      {next === "questionnaire" && questionnaire ? (
        <div className="card p-5 space-y-4">
          <h2 className="font-display text-lg">{questionnaire.name}</h2>
          {questionnaire.fields.map((f) => (
            <div key={f.id}>
              <label className="label">
                {f.label}
                {f.required ? " *" : ""}
              </label>
              {f.type === "textarea" ? (
                <textarea className="input min-h-[80px]" value={answers[f.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })} />
              ) : f.type === "choice" ? (
                <select className="input" value={answers[f.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })}>
                  <option value="">Choose…</option>
                  {f.options
                    .split(",")
                    .map((o) => o.trim())
                    .filter(Boolean)
                    .map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                </select>
              ) : (
                <input className="input" type={f.type === "date" ? "date" : "text"} value={answers[f.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })} />
              )}
            </div>
          ))}
          <button className="btn-primary" disabled={busy} onClick={() => post({ action: "answers", answers })}>
            Save answers
          </button>
        </div>
      ) : null}

      {next === "contract" && contract ? (
        <div className="card p-5 space-y-4">
          <h2 className="font-display text-lg">{contract.title}</h2>
          <div className="text-sm whitespace-pre-wrap text-neutral-700 max-h-72 overflow-y-auto border border-neutral-100 rounded-md p-4 bg-neutral-50">{contract.body}</div>
          <div>
            <label className="label">Your full legal name *</label>
            <input className="input max-w-sm" value={signName} onChange={(e) => setSignName(e.target.value)} />
          </div>
          <div className="flex gap-4 text-sm">
            <button className={mode === "type" ? "tab-active pb-1" : "tab-inactive pb-1"} onClick={() => setMode("type")}>
              Type signature
            </button>
            <button className={mode === "draw" ? "tab-active pb-1" : "tab-inactive pb-1"} onClick={() => setMode("draw")}>
              Draw signature
            </button>
          </div>
          {mode === "type" ? (
            signName.trim() ? <p className="font-display italic text-2xl">{signName}</p> : null
          ) : (
            <SignaturePad onChange={setDrawn} />
          )}
          <label className="flex items-start gap-2 text-sm text-neutral-600 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I have read and agree to the terms, and I intend my signature to act as my electronic signature.
          </label>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() =>
              mode === "draw" && !drawn
                ? setError("Draw your signature in the box.")
                : post({ name: signName, agree, signatureImage: mode === "draw" ? drawn : "" }, `/api/sign/${contract.token}`)
            }
          >
            Sign agreement
          </button>
        </div>
      ) : null}

      {next === "payment" && payment ? (
        <div className="card p-5 space-y-3">
          <h2 className="font-display text-lg">Retainer, {money(payment.cents)}</h2>
          <p className="text-sm text-neutral-600">
            Online payment is not enabled yet, and you have not been charged. Your photographer will arrange the retainer with you.
            Once they record it, you can confirm your booking here.
          </p>
        </div>
      ) : null}

      {next === "confirm" ? (
        <div className="card p-5 space-y-3 text-center">
          <h2 className="font-display text-lg">Everything is ready</h2>
          <p className="text-sm text-neutral-500">Confirm your booking to lock in this time.</p>
          <button className="btn-primary" disabled={busy} onClick={() => post({ action: "complete" })}>
            Confirm my booking
          </button>
        </div>
      ) : null}
    </div>
  );
}
