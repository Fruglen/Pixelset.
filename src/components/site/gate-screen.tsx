import { siteThemeStyle, type SiteWithPages } from "@/lib/site-data";
import { PasswordGateForm } from "./password-gate";

// Night build (Website): full screen password gate shown instead of a
// protected site or page. Uses the site's own theme so it feels native.
export function GateScreen({
  website,
  pageId,
  label,
}: {
  website: SiteWithPages;
  pageId?: string;
  label: string;
}) {
  return (
    <div className="site-root" style={siteThemeStyle(website)}>
      <main className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="text-center space-y-8 w-full">
          <p className="font-display text-3xl sm:text-4xl" style={{ fontFamily: "var(--s-display)" }}>
            {website.logoText || website.slug}
          </p>
          <PasswordGateForm slug={website.slug} pageId={pageId} label={label} />
        </div>
      </main>
    </div>
  );
}
