import type { MetadataRoute } from "next";

function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  return [
    { url: `${siteUrl}/`, changeFrequency: "always", priority: 1 },
    { url: `${siteUrl}/search`, changeFrequency: "daily", priority: 0.5 },
    { url: `${siteUrl}/servers`, changeFrequency: "daily", priority: 0.5 },
  ];
}
