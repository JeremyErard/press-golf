// JSON-LD structured data for SEO

export function generateAppJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Press",
    alternateName: "Press Golf Side Games",
    applicationCategory: "SportsApplication",
    operatingSystem: "iOS, Android, Web",
    offers: {
      "@type": "Offer",
      price: "2.49",
      priceCurrency: "USD",
    },
    description:
      "The #1 app for tracking golf side games with friends. Nassau, Skins, Wolf, and 7 more games. Live scoring and easy settlement via Venmo, Apple Pay & more.",
    screenshot: "https://pressbet.golf/images/og-image.jpg",
    featureList: [
      "Nassau game tracking",
      "Skins game tracking",
      "Wolf game support",
      "Match Play scoring",
      "Live real-time updates",
      "Automatic settlement calculation",
      "Venmo integration",
      "Apple Pay support",
      "Cash App integration",
      "Zelle support",
      "GHIN handicap import",
      "Dots and extras tracking",
    ],
  };
}

export function generateOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Press",
    url: "https://pressbet.golf",
    logo: "https://pressbet.golf/icons/icon-512x512.png",
  };
}

export function generateWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Press",
    url: "https://pressbet.golf",
    description: "Golf side games made simple. Track games, keep score, settle up.",
  };
}
