import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { LeadFormClient } from "./lead-form-client";

export const dynamic = "force-dynamic";

async function load(token: string) {
  const form = await db.leadForm.findUnique({ where: { token } });
  if (!form || !form.active) return null;
  const user = await db.user.findUnique({ where: { id: form.userId } });
  return user ? { form, user } : null;
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const d = await load(params.token);
  return { title: d ? `${d.form.heading || d.form.name}, ${d.user.businessName || d.user.name}` : "Contact" };
}

// Phase 5B: standalone lead form page, shareable as a direct link, bio link, or email signature link.
export default async function LeadFormPage({ params, searchParams }: { params: { token: string }; searchParams: { embed?: string } }) {
  const d = await load(params.token);
  if (!d) notFound();
  const { form, user } = d;
  const fields = JSON.parse(form.fields || "[]") as { id: string; type: string; label: string; options: string; required: boolean }[];
  const embed = searchParams.embed === "1";
  return (
    <div className={`${embed ? "bg-white p-4" : "min-h-screen bg-[#faf9f7] py-12 px-4"} text-ink`}>
      <div className="max-w-xl mx-auto">
        {!embed ? <p className="text-center text-xs uppercase tracking-[0.25em] text-neutral-400 mb-2">{user.businessName || user.name}</p> : null}
        <h1 className="font-display text-2xl text-center">{form.heading || form.name}</h1>
        {form.intro ? <p className="text-sm text-neutral-600 text-center mt-3 mb-8">{form.intro}</p> : <div className="mb-8" />}
        <LeadFormClient token={params.token} fields={fields} />
      </div>
    </div>
  );
}
