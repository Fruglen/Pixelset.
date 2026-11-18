import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { applyScheduledSends, contractDerivedStatus } from "@/lib/studio";
import { formatDateTime } from "@/lib/utils";
import { SignForm } from "./sign-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign agreement" };

export default async function SignPage({ params }: { params: { token: string } }) {
  await applyScheduledSends(undefined, params.token);
  const contract = await db.contract.findUnique({
    where: { token: params.token },
    include: { user: true },
  });
  if (!contract || contract.status === "DRAFT") notFound();
  const derived = contractDerivedStatus(contract);
  const business = contract.user.businessName || contract.user.name;

  const needsFirst = !contract.signedAt;
  const needsSecond = !!contract.signedAt && !!contract.secondSignerEmail && !contract.secondSignedAt;

  return (
    <div className="min-h-screen bg-[#faf9f7] text-ink py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <p className="text-center text-xs uppercase tracking-[0.25em] text-neutral-400 mb-2">{business}</p>
        <h1 className="font-display text-2xl text-center mb-8">{contract.title}</h1>

        {/* PDF-style document */}
        <div className="bg-white border border-neutral-200 shadow-sm rounded-sm px-10 py-12">
          <div className="text-sm whitespace-pre-wrap leading-relaxed text-neutral-800">{contract.body}</div>

          <div className="mt-12 pt-6 border-t border-neutral-200 grid sm:grid-cols-2 gap-8 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-400 mb-2">Client signature</p>
              {contract.signedAt ? (
                <>
                  <p className="font-display italic text-2xl">{contract.signerName}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Signed {formatDateTime(contract.signedAt)}
                    <br />
                    IP {contract.signerIp}
                    <br />
                    <span className="break-all">{contract.signerUserAgent.slice(0, 80)}</span>
                  </p>
                </>
              ) : (
                <p className="text-neutral-400 italic border-b border-neutral-300 pb-6">Awaiting signature</p>
              )}
            </div>
            {contract.secondSignerEmail ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-400 mb-2">
                  Second signer ({contract.secondSignerEmail})
                </p>
                {contract.secondSignedAt ? (
                  <>
                    <p className="font-display italic text-2xl">{contract.secondSignerName}</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Signed {formatDateTime(contract.secondSignedAt)}
                      <br />
                      IP {contract.secondSignerIp}
                      <br />
                      <span className="break-all">{contract.secondSignerUserAgent.slice(0, 80)}</span>
                    </p>
                  </>
                ) : (
                  <p className="text-neutral-400 italic border-b border-neutral-300 pb-6">Awaiting signature</p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-8">
          {derived === "EXPIRED" ? (
            <p className="text-center text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
              This agreement expired{contract.expiresAt ? ` on ${formatDateTime(contract.expiresAt)}` : ""} and can no
              longer be signed. Contact {business} for a new copy.
            </p>
          ) : derived === "SIGNED" ? (
            <p className="text-center text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3">
              This agreement is fully signed. A copy was emailed to all parties.
            </p>
          ) : needsFirst || needsSecond ? (
            <SignForm
              token={params.token}
              secondSigner={needsSecond}
              expiresAt={contract.expiresAt ? formatDateTime(contract.expiresAt) : ""}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
