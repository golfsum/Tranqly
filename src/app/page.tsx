import AppShell from "@/components/AppShell";
import ComingSoonLanding from "./coming-soon/ComingSoonLanding";

const SHOW_COMING_SOON =
  process.env.NEXT_PUBLIC_TRANQLY_COMING_SOON === "true" ||
  process.env.TRANQLY_COMING_SOON === "true";

export default function Page() {
  if (SHOW_COMING_SOON) {
    return <ComingSoonLanding />;
  }

  return <AppShell />;
}
