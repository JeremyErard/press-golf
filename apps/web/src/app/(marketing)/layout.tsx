import type { Metadata } from "next";
import Image from "next/image";
import {
  generateAppJsonLd,
  generateOrganizationJsonLd,
  generateWebsiteJsonLd,
} from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Press - Golf Side Games App | Track Nassau, Skins & Wolf",
  description:
    "The #1 app for tracking golf side games with friends. Nassau, Skins, Wolf, and 7 more games. Live scoring and easy settlement via Venmo, Apple Pay & more.",
  keywords: [
    "golf side games app",
    "nassau golf game",
    "golf skins game",
    "wolf golf game",
    "golf scoring app",
    "golf games tracker",
    "golf scorecard app",
    "golf friends app",
  ],
  openGraph: {
    type: "website",
    title: "Press - Golf Side Games App | Track Nassau, Skins & Wolf",
    description:
      "Track golf side games with your buddies. 10 game types including Nassau, Skins, Wolf. Easy settlement with Venmo, Apple Pay & more.",
    siteName: "Press",
    url: "https://pressbet.golf",
    images: [
      {
        url: "https://pressbet.golf/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Press Golf Side Games App",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Press - Golf Side Games App",
    description:
      "Track golf side games with your buddies. 10 game types. Easy settlement.",
    images: ["https://pressbet.golf/images/og-image.jpg"],
  },
  alternates: {
    canonical: "https://pressbet.golf",
  },
  themeColor: "#0a1628",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appJsonLd = generateAppJsonLd();
  const orgJsonLd = generateOrganizationJsonLd();
  const websiteJsonLd = generateWebsiteJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([appJsonLd, orgJsonLd, websiteJsonLd]),
        }}
      />
      <div className="relative min-h-screen">
        {/* Subtle fairway texture backdrop */}
        <div className="fixed inset-0 -z-10">
          <Image
            src="/images/fairway-texture.jpg"
            alt=""
            fill
            className="object-cover opacity-[0.03]"
            priority
          />
          <div className="absolute inset-0 bg-background" style={{ mixBlendMode: 'multiply' }} />
        </div>
        {children}
      </div>
    </>
  );
}
