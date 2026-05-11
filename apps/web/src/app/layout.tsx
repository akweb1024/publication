import "./globals.css";
import type { Metadata } from "next";
import { Source_Serif_4, Space_Grotesk } from "next/font/google";
import Logo from "../components/Logo";
import TopNav from "../components/TopNav";

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
  title: "Publication Platform | Editorial Workspace",
  description: "Multi-journal publishing platform for submissions, review, and publication.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <div className="site-shell">
          <header className="site-header">
            <div className="container header-row">
              <a href="/" className="brand">
                <Logo style={{ height: "48px", width: "48px", flexShrink: 0 }} />
                <span className="brand-copy">
                  <strong>STM Journals</strong>
                  <small>&#123;Scientific, Technical, Medical&#125;</small>
                </span>
              </a>
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
                  <li><a href="/" style={{ color: "var(--ink-700)", textDecoration: "none" }}>Journals Directory</a></li>
                  <li><a href="/about" style={{ color: "var(--ink-700)", textDecoration: "none" }}>About Us</a></li>
                  <li><a href="/policies" style={{ color: "var(--ink-700)", textDecoration: "none" }}>Policies & Ethics</a></li>
                </ul>
              </div>
              <div>
                <p style={{ fontWeight: 600, color: "var(--ink-800)", marginBottom: "12px" }}>Information For</p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                  <li><a href="/authors" style={{ color: "var(--ink-700)", textDecoration: "none" }}>Authors</a></li>
                  <li><a href="/readers" style={{ color: "var(--ink-700)", textDecoration: "none" }}>Readers</a></li>
                  <li><a href="/editors" style={{ color: "var(--ink-700)", textDecoration: "none" }}>Editors</a></li>
                  <li><a href="/subscribers" style={{ color: "var(--ink-700)", textDecoration: "none" }}>Subscribers</a></li>
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
