import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import ThemeApplier from "@/components/ThemeApplier";

const COMING_SOON_FLAG =
  process.env.NEXT_PUBLIC_TRANQLY_COMING_SOON ??
  process.env.TRANQLY_COMING_SOON;
const SHOW_COMING_SOON = COMING_SOON_FLAG === "true";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://tranqly.com"),
  title: "Tranqly: Daily Reflections",
  description:
    "Your AI reflection companion in your pocket. Share what you did today, get warmth, encouragement, and one gentle next step.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Tranqly: Daily Reflections",
    description: "Reflect for one minute a day. Tranqly remembers what matters and helps you notice patterns over time.",
    url: "/",
    siteName: "Tranqly",
    images: [{ url: "/tranqly_logo.png", width: 1024, height: 1024, alt: "Tranqly app icon" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tranqly: Daily Reflections",
    description: "Reflect for one minute a day. Tranqly remembers what matters and helps you notice patterns over time.",
    images: ["/tranqly_logo.png"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tranqly: Daily Reflections",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0E14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={SHOW_COMING_SOON ? "font-sans landing-body" : "font-sans app-body"}>
        {!SHOW_COMING_SOON && <ThemeApplier />}
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
