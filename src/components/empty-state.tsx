import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

// Designed empty state for list pages: icon in a soft accent disc, one
// line of copy, and an optional accent CTA (link or custom node).
export function EmptyState({
  icon: Icon,
  line,
  ctaLabel,
  ctaHref,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  line: string;
  ctaLabel?: string;
  ctaHref?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white/60 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-4 max-w-sm text-sm text-neutral-500">{line}</p>
      {ctaLabel && ctaHref ? (
        <Link href={ctaHref} className="btn-primary mt-5 !px-4 !py-2 text-sm">
          {ctaLabel}
        </Link>
      ) : null}
      {children}
    </div>
  );
}
