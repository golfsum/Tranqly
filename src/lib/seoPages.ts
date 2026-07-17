import type { Metadata } from "next";
import type { SeoRelatedLink } from "@/components/SeoPage";
import { absoluteUrl } from "@/lib/site";

export function seoMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "Tranqly",
      type: "website",
      images: [{ url: "/coming-soon/insights.jpeg", width: 844, height: 1833, alt: "Tranqly daily reflection app" }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/coming-soon/insights.jpeg"] },
  };
}

export const relatedLinks: SeoRelatedLink[] = [
  { href: "/ai-reflection-journal", title: "AI reflection journal", description: "See how Tranqly turns a short check-in into a thoughtful observation." },
  { href: "/daily-reflection-prompts", title: "Daily reflection prompts", description: "Use gentle questions when you are not sure where to begin." },
  { href: "/weekly-reflection", title: "Weekly reflection", description: "Bring a week of small moments together without demanding perfection." },
  { href: "/voice-journal", title: "Voice journal", description: "Speak naturally for up to 60 seconds and keep the final transcript." },
  { href: "/sanctuary-journal", title: "Sanctuary journal", description: "Unlock peaceful places through lifetime reflection days, not streaks." },
  { href: "/how-tranqly-works", title: "How Tranqly works", description: "Follow the full Reflect, Notice, Grow, and Explore experience." },
];

export function linksWithout(path: string) {
  return relatedLinks.filter((item) => item.href !== path).slice(0, 3);
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Tranqly: Daily Reflections",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "iOS",
    description: "A private daily reflection companion for voice or text check-ins, AI insights, weekly reflections, and peaceful sanctuary progression.",
    url: absoluteUrl(),
    offers: [
      { "@type": "Offer", price: "5.99", priceCurrency: "USD", category: "monthly subscription" },
      { "@type": "Offer", price: "59.99", priceCurrency: "USD", category: "yearly subscription" },
    ],
  };
}
