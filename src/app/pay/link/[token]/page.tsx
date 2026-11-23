import { notFound } from "next/navigation";
import { brandFor, brandVars } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getStudioProfile } from "@/lib/studio";
import { PayLinkClient } from "./pay-link-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment" };

export default async function PayLinkPage({ params }: { params: { token: string } }) {
  const link = await db.paymentLink.findUnique({ where: { token: params.token } });
  if (!link || !link.active) notFound();
  const user = await db.user.findUnique({ where: { id: link.userId } });
  if (!user) notFound();
  const profile = await getStudioProfile(user.id);
  const brand = await brandFor(user.id);
  return (
    <div className="min-h-screen bg-[#faf9f7] text-ink py-12 px-4 branded" style={brandVars(brand)}>
      <div className="max-w-md mx-auto">
        <div className="mb-3"><BrandMark brand={brand} /></div>
        <h1 className="font-display text-2xl text-center">{link.title}</h1>
        {link.description ? <p className="text-sm text-neutral-600 text-center mt-3">{link.description}</p> : null}
        <div className="mt-8">
          <PayLinkClient
            fixedCents={link.amountCents}
            howToPay={profile.showManual && profile.manualEnabled ? profile.manualInstructions.trim() : ""}
          />
        </div>
      </div>
    </div>
  );
}
