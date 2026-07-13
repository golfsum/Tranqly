import SiteAnalyticsTracker from "@/components/SiteAnalyticsTracker";
import ComingSoonLanding from "./coming-soon/ComingSoonLanding";

const COMING_SOON_FLAG =
  process.env.NEXT_PUBLIC_TRANQLY_COMING_SOON ??
  process.env.TRANQLY_COMING_SOON;
const SHOW_COMING_SOON = COMING_SOON_FLAG === "true";

export default function Page() {
  if (SHOW_COMING_SOON) {
    return (
      <>
        <SiteAnalyticsTracker page="home" />
        <ComingSoonLanding />
      </>
    );
  }

  return (
    <>
      <SiteAnalyticsTracker page="home" />
      <ComingSoonLanding launchMode />
    </>
  );
}
