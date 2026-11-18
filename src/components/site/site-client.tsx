"use client";

import { useEffect, useState } from "react";

// Interactive pieces of the public site (forms post to the site's inbox).

export function Slideshow({
  slides,
  heading,
  heightClass,
}: {
  slides: { image: string; imageAlt: string; caption: string }[];
  heading: string;
  heightClass: string;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 4500);
    return () => clearInterval(t);
  }, [slides.length]);

  if (slides.length === 0) return null;
  return (
    <div className={`relative overflow-hidden ${heightClass}`}>
      {slides.map((s, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={s.image}
          alt={s.imageAlt}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}
      {heading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <h1 className="site-display text-white text-4xl md:text-6xl text-center px-6">{heading}</h1>
        </div>
      ) : null}
      {slides.length > 1 ? (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`w-2 h-2 rounded-full ${i === index ? "bg-white" : "bg-white/40"}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function useSubmit(siteSlug: string) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  async function submit(payload: Record<string, string>) {
    setState("sending");
    setError("");
    const res = await fetch(`/api/site/${siteSlug}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) setState("done");
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setState("error");
    }
  }
  return { state, error, submit };
}

export function ContactForm({
  siteSlug,
  askPhone,
  askSubject,
  buttonLabel,
  success,
}: {
  siteSlug: string;
  askPhone: boolean;
  askSubject: boolean;
  buttonLabel: string;
  success: string;
}) {
  const { state, error, submit } = useSubmit(siteSlug);
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", body: "" });

  if (state === "done") {
    return <p className="text-center py-10 site-accent text-lg">{success}</p>;
  }
  return (
    <form
      className="max-w-xl mx-auto space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit({ kind: "CONTACT", ...form });
      }}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <input className="site-input" placeholder="Your name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="site-input" type="email" placeholder="Email *" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      {askPhone ? (
        <input className="site-input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      ) : null}
      {askSubject ? (
        <input className="site-input" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
      ) : null}
      <textarea className="site-input" rows={6} placeholder="Tell me about your day *" required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
      {state === "error" ? <p className="text-sm text-red-500">{error}</p> : null}
      <div className="text-center">
        <button type="submit" disabled={state === "sending"} className="site-btn">
          {state === "sending" ? "Sending…" : buttonLabel}
        </button>
      </div>
    </form>
  );
}

export function BookingForm({
  siteSlug,
  sessionTypes,
  buttonLabel,
  success,
}: {
  siteSlug: string;
  sessionTypes: string[];
  buttonLabel: string;
  success: string;
}) {
  const { state, error, submit } = useSubmit(siteSlug);
  const [form, setForm] = useState({ name: "", email: "", sessionType: sessionTypes[0] ?? "", date: "", body: "" });

  if (state === "done") {
    return <p className="text-center py-10 site-accent text-lg">{success}</p>;
  }
  return (
    <form
      className="max-w-xl mx-auto space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          kind: "BOOKING",
          name: form.name,
          email: form.email,
          body: form.body,
          subject: `Booking request: ${form.sessionType}`,
          meta: `${form.sessionType}${form.date ? ` · preferred date ${form.date}` : ""}`,
        });
      }}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <input className="site-input" placeholder="Your name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="site-input" type="email" placeholder="Email *" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <select className="site-input" value={form.sessionType} onChange={(e) => setForm({ ...form, sessionType: e.target.value })}>
          {sessionTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input className="site-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="Preferred date" />
      </div>
      <textarea className="site-input" rows={4} placeholder="Anything we should know?" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
      {state === "error" ? <p className="text-sm text-red-500">{error}</p> : null}
      <div className="text-center">
        <button type="submit" disabled={state === "sending"} className="site-btn">
          {state === "sending" ? "Sending…" : buttonLabel}
        </button>
      </div>
    </form>
  );
}

export function NewsletterForm({ siteSlug, buttonLabel }: { siteSlug: string; buttonLabel: string }) {
  const { state, error, submit } = useSubmit(siteSlug);
  const [email, setEmail] = useState("");

  if (state === "done") {
    return <p className="site-accent text-sm py-2">You're on the list, thank you.</p>;
  }
  return (
    <form
      className="flex gap-2 max-w-md mx-auto"
      onSubmit={(e) => {
        e.preventDefault();
        submit({ kind: "NEWSLETTER", email, subject: "Newsletter signup" });
      }}
    >
      <input className="site-input" type="email" required placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit" disabled={state === "sending"} className="site-btn whitespace-nowrap">
        {state === "sending" ? "…" : buttonLabel}
      </button>
      {state === "error" ? <span className="text-sm text-red-500 self-center">{error}</span> : null}
    </form>
  );
}
