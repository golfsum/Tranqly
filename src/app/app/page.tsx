import AppShell from "@/components/AppShell";
import SiteAnalyticsTracker from "@/components/SiteAnalyticsTracker";

export default function WebAppPage() {
  return (
    <>
      <SiteAnalyticsTracker page="app" />
      <AppShell />
    </>
  );
}
