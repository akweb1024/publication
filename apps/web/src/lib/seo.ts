import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function buildCanonical(path: string) {
  const normalized = normalizePath(path);
  return normalized === "/" ? siteUrl : `${siteUrl}${normalized}`;
}

type SeoPageOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  type?: "website" | "article";
  noIndex?: boolean;
};

export function createPageMetadata({
  title,
  description,
  path,
  keywords,
  type = "website",
  noIndex = false,
}: SeoPageOptions): Metadata {
  const canonical = buildCanonical(path);
  const robots = noIndex
    ? {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
      }
    : undefined;

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    robots,
    openGraph: {
      type,
      url: canonical,
      title,
      description,
      siteName: "STM Journals",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export function getSiteUrl() {
  return siteUrl;
}
