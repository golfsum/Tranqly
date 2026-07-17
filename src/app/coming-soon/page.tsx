import type { Metadata } from "next";
import SiteAnalyticsTracker from "@/components/SiteAnalyticsTracker";
import ComingSoonLanding from "./ComingSoonLanding";

export const metadata: Metadata = {
  title: "Tranqly: Daily Reflections",
  alternates: { canonical: "/" },
  robots: { index: false, follow: true },
};

export default function ComingSoonPage() {
  return (
    <>
      <SiteAnalyticsTracker page="coming-soon" />
      <ComingSoonLanding />
    </>
  );
}
