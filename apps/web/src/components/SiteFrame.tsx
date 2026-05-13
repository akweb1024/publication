"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import TopNav from "./TopNav";

export default function SiteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  if (isDashboard) return <>{children}</>;

  return (
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
  );
}

