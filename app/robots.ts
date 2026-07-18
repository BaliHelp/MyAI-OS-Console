import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/login",
        "/terms",
        "/privacy",
        "/docs",
        "/api-reference",
        "/examples",
        "/guides"
      ],
      disallow: [
        "/dashboard",
        "/api/"
      ],
    },
    sitemap: "https://console.myai.bali.technology/sitemap.xml",
  };
}
