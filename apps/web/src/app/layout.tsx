import "./globals.css";
import type { Metadata } from "next";
import { Source_Serif_4, Space_Grotesk } from "next/font/google";
import SiteFrame from "../components/SiteFrame";
import { getSiteUrl } from "../lib/seo";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "700"],
});

const bodyFont = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Publication Platform | Editorial Workspace",
  description: "Multi-journal publishing platform for submissions, review, and publication.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "Publication Platform | Editorial Workspace",
    description: "Multi-journal publishing platform for submissions, review, and publication.",
    siteName: "STM Journals",
  },
  twitter: {
    card: "summary_large_image",
    title: "Publication Platform | Editorial Workspace",
    description: "Multi-journal publishing platform for submissions, review, and publication.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const siteUrl = getSiteUrl();
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "STM Journals",
    url: siteUrl,
    logo: `${siteUrl}/favicon.ico`,
    sameAs: [siteUrl],
  };
  const webSiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "STM Journals",
    url: siteUrl,
    publisher: {
      "@type": "Organization",
      name: "STM Journals",
      url: siteUrl,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/journals?query={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }} />
        <SiteFrame>{children}</SiteFrame>
      </body>
    </html>
  );
}
