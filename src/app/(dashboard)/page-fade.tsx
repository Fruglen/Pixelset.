"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Re-mounts page content on navigation so the .page-enter fade applies
// per page without changing the layout structure.
export function PageFade({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
