import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: Array<{
    path: string;
    changeFrequency: "weekly" | "monthly";
    priority: number;
  }> = [
    { path: "", changeFrequency: "weekly", priority: 1 },
    { path: "/ai-reflection-journal", changeFrequency: "monthly", priority: 0.85 },
    { path: "/daily-reflection-prompts", changeFrequency: "monthly", priority: 0.85 },
    { path: "/voice-journal", changeFrequency: "monthly", priority: 0.8 },
    { path: "/weekly-reflection", changeFrequency: "monthly", priority: 0.8 },
    { path: "/sanctuary-journal", changeFrequency: "monthly", priority: 0.8 },
    { path: "/how-tranqly-works", changeFrequency: "monthly", priority: 0.8 },
    { path: "/privacy", changeFrequency: "monthly", priority: 0.4 },
    { path: "/terms", changeFrequency: "monthly", priority: 0.4 },
  ];

  return pages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
