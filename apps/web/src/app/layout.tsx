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
                  <small>Scholarly Publishing Platform</small>
                </span>
              </Link>
              <TopNav />
            </div>
          </header>
          <main className="container" style={{ flexGrow: 1 }}>{children}</main>
          <footer className="site-footer">
            <div className="container footer-grid">
              <div className="footer-brand">
                <p className="footer-title">STM Journals Platform</p>
                <p>International scholarly publishing infrastructure for transparent editorial and peer-review workflows.</p>
              </div>
              <div>
                <p className="footer-col-title">Platform</p>
                <ul className="footer-links">
                  <li><Link href="/journals">Journals Directory</Link></li>
                  <li><Link href="/about">About Us</Link></li>
                  <li><Link href="/policies">Policies & Ethics</Link></li>
                </ul>
              </div>
              <div>
                <p className="footer-col-title">Information For</p>
                <ul className="footer-links">
                  <li><Link href="/authors">Author Guidelines</Link></li>
                  <li><Link href="/readers">Readers</Link></li>
                  <li><Link href="/editors">Reviewer Guidelines</Link></li>
                  <li><Link href="/subscribers">Subscribers</Link></li>
                </ul>
              </div>
              <div>
                <p className="footer-col-title">Journal Links</p>
                <ul className="footer-links">
                  <li><Link href="/journals">Browse Journals</Link></li>
                  <li><Link href="/journals">Editorial Board</Link></li>
                  <li><Link href="/journals">Archive</Link></li>
                  <li><Link href="/about">Contact</Link></li>
                </ul>
              </div>
            </div>
            <div className="container footer-bottom">© 2026 STM Journals. All rights reserved.</div>
          </footer>
          <div className="bg-orb orb-a" />
          <div className="bg-orb orb-b" />
          <div className="bg-grid" />
        </div>
      </body>
    </html>
  );
}
