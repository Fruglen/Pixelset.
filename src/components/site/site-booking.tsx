"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { BookingFlow } from "@/app/book/[slug]/[typeId]/booking-flow";
import type { SiteBookingData } from "@/lib/site-booking";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Phase 5B: Booking calendar block. Lists the open Studio Manager sessions and
// embeds the real booking flow (live slots, details, contract, retainer)
// right inside the website page.
export function SiteBooking({ data, layout }: { data: SiteBookingData; layout: string }) {
  const [openId, setOpenId] = useState<string | null>(data.sessions.length === 1 ? data.sessions[0].sessionType.id : null);
  const open = data.sessions.find((s) => s.sessionType.id === openId) ?? null;

  if (open) {
    return (
      <div className="bg-white text-neutral-900 rounded-md p-6 md:p-8 shadow-sm">
        {data.sessions.length > 1 ? (
          <button className="text-sm text-neutral-500 hover:text-neutral-900 mb-4" onClick={() => setOpenId(null)}>
            ← All sessions
          </button>
        ) : null}
        <BookingFlow
          key={open.sessionType.id}
          slug={data.slug}
          sessionType={open.sessionType}
          addOns={open.addOns}
          questionnaireFields={open.questionnaireFields}
          dates={open.dates}
          payMethods={data.payMethods}
        />
      </div>
    );
  }

  if (data.sessions.length === 0) {
    return <p className="site-subtle text-center">No sessions are open for booking right now, check back soon.</p>;
  }

  return (
    <div className={layout === "list" ? "space-y-3" : "grid gap-5 md:grid-cols-2"}>
      {data.sessions.map(({ sessionType: t, dates, openSpots }) => (
        <button
          key={t.id}
          onClick={() => setOpenId(t.id)}
          className={`text-left border transition-shadow hover:shadow-md ${layout === "list" ? "flex items-center gap-4 p-4" : "flex flex-col"}`}
          style={{ borderColor: "color-mix(in srgb, var(--s-text) 15%, transparent)" }}
        >
          {t.coverUrl && layout !== "list" ? <img src={t.coverUrl} alt="" className="w-full aspect-[16/9] object-cover" /> : null}
          <div className={layout === "list" ? "flex-1" : "p-5"}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="site-display text-xl">{t.name}</h3>
              <span className="text-sm whitespace-nowrap">{money(t.priceCents)}</span>
            </div>
            <p className="site-subtle text-xs mt-1">
              {t.durationMin} min
              {t.locationType === "ZOOM" ? " · Zoom" : t.location ? ` · ${t.location}` : ""}
              {t.isMini ? ` · ${dates.length} date${dates.length === 1 ? "" : "s"}, ${openSpots} open spot${openSpots === 1 ? "" : "s"}` : " · live availability"}
            </p>
            {t.description && layout !== "list" ? <p className="text-sm mt-3 site-subtle line-clamp-3">{t.description}</p> : null}
            <span className="site-btn mt-4 inline-flex">{t.isMini ? "Pick a spot" : "Check availability"}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
