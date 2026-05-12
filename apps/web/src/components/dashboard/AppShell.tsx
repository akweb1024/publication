"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Breadcrumbs from "../Breadcrumbs";

type BreadcrumbItem = { label: string; href?: string };
type JournalOption = { id: string; slug: string; title: string };

type AppShellProps = {
  title: string;
  description?: string;
  sectionLabel?: string;
  selectedJournalLabel?: string;
  actions?: ReactNode;
  breadcrumbItems: BreadcrumbItem[];
  journals?: JournalOption[];
  selectedJournalSlug?: string;
  onJournalChange?: (slug: string) => void;
  quickActions?: Array<{ label: string; href?: string; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" }>;
  children: ReactNode;
};

type NavItem = { label: string; href: string };

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Journals", href: "/journals" },
  { label: "About", href: "/about" },
  { label: "Policies", href: "/policies" },
  { label: "Author", href: "/dashboard/submissions" },
  { label: "Editorial", href: "/dashboard/editor" },
  { label: "Publishing", href: "/dashboard/publishing" },
  { label: "Audit", href: "/dashboard/audit" },
  { label: "Admin", href: "/dashboard/journals" },
  { label: "Storage", href: "/dashboard/storage" },
];

export default function AppShell({
  title,
  description,
  sectionLabel,
  selectedJournalLabel,
  actions,
  breadcrumbItems,
  journals,
  selectedJournalSlug,
  onJournalChange,
  quickActions,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeHref = useMemo(() => {
    const found = NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    return found?.href ?? "/dashboard";
  }, [pathname]);

  return (
    <main className="dashboard-shell" aria-label="Dashboard workspace">
      <aside className={`dashboard-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="dashboard-brand">
          <p className="eyebrow">STM Workspace</p>
          <h2>Publishing Console</h2>
        </div>

        <nav className="dashboard-nav" aria-label="Primary dashboard navigation">
          {NAV_ITEMS.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`dashboard-nav-item ${active ? "active" : ""}`}
                onClick={() => setMobileNavOpen(false)}
              >
                <span className="dot" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className="dashboard-content">
        <header className="dashboard-topbar">
          <button
            type="button"
            className="button button-ghost compact dashboard-menu-toggle"
            aria-label="Open dashboard navigation"
            onClick={() => setMobileNavOpen((value) => !value)}
          >
            Menu
          </button>
          <div className="dashboard-topbar-meta">
            <Breadcrumbs items={breadcrumbItems} />
            {journals?.length && onJournalChange ? (
              <div className="dashboard-switcher field">
                <label htmlFor="journal-switcher">Active Journal</label>
                <select
                  id="journal-switcher"
                  className="select"
                  value={selectedJournalSlug ?? ""}
                  onChange={(event) => onJournalChange(event.target.value)}
                >
                  {journals.map((journal) => (
                    <option key={journal.id} value={journal.slug}>
                      {journal.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </header>

        <section className="dashboard-page-header card" aria-label="Page header">
          <div>
            {sectionLabel ? <p className="eyebrow">{sectionLabel}</p> : null}
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
            {selectedJournalLabel ? <span className="chip" style={{ marginTop: 8, display: "inline-flex" }}>{selectedJournalLabel}</span> : null}
          </div>
          <div className="dashboard-page-header-actions">{actions}</div>
        </section>

        {quickActions?.length ? (
          <section className="card">
            <p className="eyebrow">Quick Actions</p>
            <div className="dashboard-quick-actions" style={{ marginTop: 10 }}>
              {quickActions.map((action) => {
                const className = `button compact ${
                  action.variant === "primary"
                    ? "button-primary"
                    : action.variant === "secondary"
                      ? ""
                      : "button-ghost"
                }`;
                if (action.href) {
                  return (
                    <Link key={`${action.label}-${action.href}`} href={action.href} className={className}>
                      {action.label}
                    </Link>
                  );
                }
                return (
                  <button key={action.label} className={className} type="button" onClick={action.onClick}>
                    {action.label}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="dashboard-page-content">{children}</div>
      </section>
    </main>
  );
}
