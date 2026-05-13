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

function inferCurrentLabel(pathname: string) {
  if (pathname.includes("/focus-scope")) return "Focus & Scope";
  if (pathname.includes("/editorial-board")) return "Editorial Board";
  if (pathname.includes("/archive")) return "Archive";
  if (pathname.includes("/policies")) return "Policies";
  return "Overview";
}

export default function JournalNav({ journalSlug, journalTitle }: JournalNavProps) {
  const pathname = usePathname();
  const currentLabel = inferCurrentLabel(pathname);

  return (
    <section className="journal-nav-shell">
      <nav className="journal-breadcrumbs" aria-label="Journal breadcrumb">
        <Link href="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link href="/journals">Journals</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/${journalSlug}`}>{journalTitle || journalSlug}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{currentLabel}</span>
      </nav>

      <div className="journal-nav-title">
        <h1>{journalTitle || journalSlug}</h1>
      </div>

      <nav className="journal-tabs" aria-label="Journal pages">
        {links.map((link) => {
          const href = `/${journalSlug}${link.path}`;
          const isActive = link.path === "" ? pathname === `/${journalSlug}` : pathname.startsWith(`/${journalSlug}${link.path}`);

          return (
            <Link key={link.key} href={href} className={`journal-tab ${isActive ? "journal-tab-active" : ""}`} aria-current={isActive ? "page" : undefined}>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
