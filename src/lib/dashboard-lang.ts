import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { dashT, resolveDashLang, type DashLang } from "@/lib/dashboard-i18n";

/** Server side: the dashboard language for the signed in account (account locale, or the browser language when set to auto). */
export async function getDashLang(): Promise<DashLang> {
  const user = await getCurrentUser();
  return resolveDashLang(user?.locale, headers().get("accept-language"));
}

export async function getDashT() {
  return dashT(await getDashLang());
}
