import { notFound } from "next/navigation";
import { brandFor, brandVars } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";
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

  // Phase 5B platform: the contract's own branding wins; otherwise the account brand applies.
  const brand = await brandFor(contract.userId);
  const accent = /^#[0-9a-fA-F]{6}$/.test(contract.brandColor) ? contract.brandColor : brand.custom ? brand.color : "";
  const logoUrl = contract.brandLogoUrl || brand.logoUrl;

  return (
    <div className="min-h-screen bg-[#faf9f7] text-ink py-10 px-4 branded" style={brandVars(brand)}>
      <div className="max-w-2xl mx-auto">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={`${business} logo`} className="mx-auto max-h-16 max-w-[220px] object-contain mb-3" />
        ) : null}
        <p className="text-center text-xs uppercase tracking-[0.25em] text-neutral-400 mb-2" style={accent ? { color: accent } : undefined}>
          {business}
        </p>
        <h1 className="font-display text-2xl text-center mb-8">{contract.title}</h1>

        {/* PDF-style document */}
        <div className="bg-white border border-neutral-200 shadow-sm rounded-sm overflow-hidden" style={accent ? { borderTop: `4px solid ${accent}` } : undefined}>
          {contract.headerImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={contract.headerImageUrl} alt="" className="w-full h-40 sm:h-52 object-cover" />
          ) : null}
          <div className="px-6 sm:px-10 py-12">
          <div className="text-sm whitespace-pre-wrap leading-relaxed text-neutral-800">{contract.body}</div>

          <div className="mt-12 pt-6 border-t border-neutral-200 grid sm:grid-cols-2 gap-8 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-400 mb-2">Client signature</p>
              {contract.signedAt ? (
                <>
                  {contract.signatureImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={contract.signatureImage} alt={`Signature of ${contract.signerName}`} className="h-16 max-w-full object-contain" />
                  ) : (
                    <p className="font-display italic text-2xl">{contract.signerName}</p>
                  )}
                  {contract.signatureImage ? <p className="text-sm">{contract.signerName}</p> : null}
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
                    {contract.secondSignatureImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={contract.secondSignatureImage} alt={`Signature of ${contract.secondSignerName}`} className="h-16 max-w-full object-contain" />
                    ) : (
                      <p className="font-display italic text-2xl">{contract.secondSignerName}</p>
                    )}
                    {contract.secondSignatureImage ? <p className="text-sm">{contract.secondSignerName}</p> : null}
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
        </div>

        <div className="mt-8">
          {derived === "EXPIRED" ? (
            <p className="text-center text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
              This agreement expired{contract.expiresAt ? ` on ${formatDateTime(contract.expiresAt)}` : ""} and can no
              longer be signed. Contact {business} for a new copy.
            </p>
          ) : derived === "SIGNED" ? (
            <p className="text-center text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3">
              This agreement is fully signed. Keep this page link as your copy, a signed copy email is sent to each signer when email is connected.
            </p>
          ) : needsFirst || needsSecond ? (
            <SignForm
              accent={accent}
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
