import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Source_Serif_4, Space_Grotesk } from "next/font/google";
import Logo from "../components/Logo";
import TopNav from "../components/TopNav";
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
        <div className="site-shell">
          <header className="site-header">
            <div className="container header-row">
              <Link href="/" className="brand">
                <Logo style={{ height: "48px", width: "48px", flexShrink: 0 }} />
                <span className="brand-copy">
                  <strong>STM Journals</strong>
                  <small>&#123;Scientific, Technical, Medical&#125;</small>
                </span>
              </Link>
              <TopNav />
            </div>
          </header>
          <main className="container" style={{ flexGrow: 1 }}>{children}</main>
          <footer className="site-footer">
            <div className="container footer-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "32px", padding: "40px 0" }}>
              <div>
                <p style={{ fontWeight: 700, color: "var(--ink-900)", marginBottom: "16px", fontSize: "1.2rem" }}>STM Journals Platform</p>
                <p style={{ marginBottom: "16px" }}>Leading the way in Scientific, Technical, and Medical publishing.</p>
                <p style={{ fontSize: "0.85rem", color: "var(--ink-600)" }}>© 2024 STM Journals Editorial Workspace</p>
              </div>
              <div>
                <p style={{ fontWeight: 600, color: "var(--ink-800)", marginBottom: "12px" }}>Platform</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                  <li><Link href="/" style={{ color: "var(--ink-700)", textDecoration: "none" }}>Journals Directory</Link></li>
                  <li><Link href="/about" style={{ color: "var(--ink-700)", textDecoration: "none" }}>About Us</Link></li>
                  <li><Link href="/policies" style={{ color: "var(--ink-700)", textDecoration: "none" }}>Policies & Ethics</Link></li>
                </ul>
              </div>
              <div>
                <p style={{ fontWeight: 600, color: "var(--ink-800)", marginBottom: "12px" }}>Information For</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                  <li><Link href="/authors" style={{ color: "var(--ink-700)", textDecoration: "none" }}>Authors</Link></li>
                  <li><Link href="/readers" style={{ color: "var(--ink-700)", textDecoration: "none" }}>Readers</Link></li>
                  <li><Link href="/editors" style={{ color: "var(--ink-700)", textDecoration: "none" }}>Editors</Link></li>
                  <li><Link href="/subscribers" style={{ color: "var(--ink-700)", textDecoration: "none" }}>Subscribers</Link></li>
                </ul>
              </div>
            </div>
          </footer>
          <div className="bg-orb orb-a" />
          <div className="bg-orb orb-b" />
          <div className="bg-grid" />
        </div>
      </body>
    </html>
  );
}
