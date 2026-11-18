import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteSettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function WebsiteSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) redirect("/website");

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
      }}
    />
  );
}
