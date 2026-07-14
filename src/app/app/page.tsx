import AppShell from "@/components/AppShell";
import SiteAnalyticsTracker from "@/components/SiteAnalyticsTracker";
import { redirect } from "next/navigation";

const WEB_APP_ENABLED =
  process.env.TRANQLY_WEB_APP_ENABLED === "true" ||
  process.env.NEXT_PUBLIC_TRANQLY_WEB_APP_ENABLED === "true";

export default function WebAppPage() {
  if (!WEB_APP_ENABLED) redirect("/");

  return (
    <>
      <SiteAnalyticsTracker page="app" />
      <AppShell />
    </>
  );
}
