"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type JournalNavProps = {
  journalSlug: string;
  journalTitle?: string;
};

const links = [
  { key: "home", label: "Overview", path: "" },
  { key: "focus-scope", label: "Focus & Scope", path: "/focus-scope" },
  { key: "editorial-board", label: "Editorial Board", path: "/editorial-board" },
  { key: "archive", label: "Archive", path: "/archive" },
  { key: "policies", label: "Policies", path: "/policies" },
];

export default function JournalNav({ journalSlug, journalTitle }: JournalNavProps) {
  const pathname = usePathname();
  
  const pathParts = pathname.split("/").filter(Boolean);
  
  let currentTabLabel = "Overview";
  if (pathParts.includes("archive")) currentTabLabel = "Archive";
  else if (pathParts.includes("policies")) currentTabLabel = "Policies";
  else if (pathParts.includes("focus-scope")) currentTabLabel = "Focus & Scope";
  else if (pathParts.includes("editorial-board")) currentTabLabel = "Editorial Board";
  else if (pathParts.includes("articles")) currentTabLabel = "Articles";

  return (
    <nav className="card" style={{ 
      padding: "16px 24px", 
      marginBottom: "24px", 
      background: "rgba(255, 255, 255, 0.95)", 
      backdropFilter: "blur(16px)",
      position: "sticky",
      top: "80px",
      zIndex: 50,
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      borderTop: "4px solid var(--accent)"
    }}>
      <div className="breadcrumbs" style={{ fontSize: "0.85rem", color: "var(--ink-600)", display: "flex", gap: "8px", alignItems: "center" }}>
        <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>All Journals</Link>
        <span>/</span>
        <Link href={`/${journalSlug}`} style={{ textDecoration: "none", color: "inherit", fontWeight: 500 }}>
          {journalTitle || journalSlug}
        </Link>
        <span>/</span>
        <span style={{ color: "var(--ink-900)", fontWeight: 700 }}>{currentTabLabel}</span>
      </div>

      <div className="meta-row" style={{ marginTop: 0, gap: "8px" }}>
        {links.map((link) => {
          const href = `/${journalSlug}${link.path}`;
          const isActive = link.path === "" 
            ? pathname === `/${journalSlug}`
            : pathname.startsWith(`/${journalSlug}${link.path}`);

          return (
            <Link
              key={link.key}
              href={href}
              className={`button compact ${isActive ? "button-primary" : "button-ghost"}`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
