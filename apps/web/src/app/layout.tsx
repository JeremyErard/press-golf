import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Press - Golf Betting Made Simple",
  description: "Track golf bets with your buddies. Nassau, Skins, Wolf, and more.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Press",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    title: "Press - Golf Betting Made Simple",
    description: "Track golf bets with your buddies. Nassau, Skins, Wolf, and more.",
    siteName: "Press",
    url: "https://pressbet.golf",
    images: [
      {
        url: "https://pressbet.golf/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Press - Golf Betting Made Simple",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Press - Golf Betting Made Simple",
    description: "Track golf bets with your buddies. Nassau, Skins, Wolf, and more.",
    images: ["https://pressbet.golf/images/og-image.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0F172A",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // @ts-expect-error Clerk + Next.js 14 async component type mismatch
    <ClerkProvider>
      <html lang="en" className="dark">
        <head>
          <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
          <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="mobile-web-app-capable" content="yes" />
        </head>
        <body className={`${geistSans.variable} ${geistMono.variable} font-sans min-h-screen`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
