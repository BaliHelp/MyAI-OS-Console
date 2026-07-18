import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://console.myai.bali.technology";

  const routes = [
    { url: `${baseUrl}/login`, priority: 1.0 },
    { url: `${baseUrl}/`, priority: 0.5 },
    { url: `${baseUrl}/terms`, priority: 0.5 },
    { url: `${baseUrl}/privacy`, priority: 0.5 },
    { url: `${baseUrl}/docs`, priority: 0.5 },
    { url: `${baseUrl}/api-reference`, priority: 0.5 },
    { url: `${baseUrl}/examples`, priority: 0.5 },
    { url: `${baseUrl}/guides`, priority: 0.5 },
  ];

  return routes.map((route) => ({
    url: route.url,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: route.priority,
  }));
}
