import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://127.0.0.1:3000";
const base = siteUrl.replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = [
    "/",
    "/parts",
    "/parts/vin",
    "/service",
    "/contacts",
    "/about",
    "/privacy",
    "/offer",
    "/favorites",
    "/cart",
    "/account/orders",
  ];

  return staticRoutes.map((route) => ({
    url: `${base}${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
