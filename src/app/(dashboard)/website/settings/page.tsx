import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteSettingsClient } from "./settings-client";
import { aRecordTarget, cnameTarget, isApex, siteRootDomain } from "@/lib/site-domains";
import { instagramSource } from "@/lib/instagram";
import { siteExt } from "@/lib/site-ext";
import { geminiConfigured } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export default async function WebsiteSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) redirect("/website");
  const ext = siteExt(website);

  return (
    <SiteSettingsClient
      website={{
        slug: website.slug,
        customDomain: website.customDomain,
        published: website.published,
        footerText: website.footerText,
        socialInstagram: website.socialInstagram,
        socialFacebook: website.socialFacebook,
        socialPinterest: website.socialPinterest,
        gaId: ext.gaId,
        fbPixelId: ext.fbPixelId,
        cookieBannerEnabled: ext.cookieBannerEnabled,
        cookieBannerText: ext.cookieBannerText,
        sitePassword: ext.sitePassword,
        aiConnected: geminiConfigured(),
      }}
      domain={{
        status: website.domainStatus,
        note: website.domainNote,
        token: website.domainToken,
        checkedAt: website.domainCheckedAt ? website.domainCheckedAt.toISOString() : null,
        apex: !!website.customDomain && isApex(website.customDomain),
        cnameTarget: cnameTarget(),
        aRecord: aRecordTarget(),
        rootDomain: siteRootDomain(),
      }}
      instagramSource={instagramSource(website)}
    />
  );
}
