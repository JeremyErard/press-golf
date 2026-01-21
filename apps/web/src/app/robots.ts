import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/rounds/",
          "/profile/",
          "/buddies/",
          "/courses/",
          "/stats/",
          "/settings/",
        ],
      },
    ],
    sitemap: "https://pressbet.golf/sitemap.xml",
  };
}
