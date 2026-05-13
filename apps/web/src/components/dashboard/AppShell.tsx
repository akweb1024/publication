"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Breadcrumbs from "../Breadcrumbs";
import { apiJson } from "../../lib/clientApi";

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
  workflowSteps?: Array<{ label: string; state: "complete" | "current" | "upcoming" }>;
  children: ReactNode;
};

type NavContext = {
  authenticated: boolean;
  capabilities?: {
    canSubmit: boolean;
    canReview: boolean;
    canEditorial: boolean;
    canPublishing: boolean;
    canManageJournal: boolean;
    canAudit: boolean;
    canSecurity: boolean;
  };
};

type NavItem = { label: string; href: string; roles?: Array<keyof NonNullable<NavContext["capabilities"]>> };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", href: "/dashboard" }] },
  {
    label: "Journals",
    items: [
      { label: "Journal Profile", href: "/dashboard/journals", roles: ["canManageJournal"] },
      { label: "Policies", href: "/dashboard/journals", roles: ["canManageJournal"] },
      { label: "Focus & Scope", href: "/dashboard/journals", roles: ["canManageJournal"] },
      { label: "Editorial Board", href: "/dashboard/journals", roles: ["canManageJournal"] },
    ],
  },
  {
    label: "Manuscripts",
    items: [
      { label: "New Submissions", href: "/dashboard/submissions", roles: ["canSubmit", "canEditorial"] },
      { label: "Under Review", href: "/dashboard/editor", roles: ["canEditorial"] },
      { label: "Reviewer Queue", href: "/dashboard/reviewer", roles: ["canReview"] },
    ],
  },
  {
    label: "Publishing",
    items: [
      { label: "Publishing Desk", href: "/dashboard/publishing", roles: ["canPublishing"] },
      { label: "Archive & Issues", href: "/dashboard/publishing", roles: ["canPublishing"] },
    ],
  },
  {
    label: "Storage & Sync",
    items: [{ label: "Storage Settings", href: "/dashboard/storage", roles: ["canManageJournal"] }],
  },
  {
    label: "Audit & Admin",
    items: [
      { label: "Audit Logs", href: "/dashboard/audit", roles: ["canAudit"] },
      { label: "Security", href: "/dashboard/security", roles: ["canSecurity"] },
    ],
  },
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
  workflowSteps,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navContext, setNavContext] = useState<NavContext | null>(null);

  useEffect(() => {
    apiJson<NavContext>("/auth/nav-context", { method: "GET" })
      .then((value) => setNavContext(value))
      .catch(() => setNavContext({ authenticated: false }));
  }, []);

  const visibleGroups = useMemo(() => {
    const capabilities = navContext?.capabilities;
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.roles || item.roles.length === 0) return true;
        if (!capabilities) return false;
        return item.roles.some((role) => capabilities[role]);
      }),
    })).filter((group) => group.items.length > 0);
  }, [navContext?.capabilities]);

  const activeHref = useMemo(() => {
    const flattened = visibleGroups.flatMap((group) => group.items);
    const found = flattened.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    return found?.href ?? "/dashboard";
  }, [pathname, visibleGroups]);

  return (
    <main className="dashboard-shell" aria-label="Dashboard workspace">
      <aside className={`dashboard-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="dashboard-brand">
          <p className="eyebrow">STM Workspace</p>
          <h2>Publishing Console</h2>
        </div>

        <nav className="dashboard-nav" aria-label="Primary dashboard navigation">
          {visibleGroups.map((group) => (
            <div key={group.label} className="dashboard-nav-group">
              <p className="dashboard-nav-group-label">{group.label}</p>
              {group.items.map((item) => {
                const active = item.href === activeHref;
                return (
                  <Link
                    key={`${group.label}-${item.label}-${item.href}`}
                    href={item.href}
                    className={`dashboard-nav-item ${active ? "active" : ""}`}
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <span className="dot" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
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

        {workflowSteps?.length ? (
          <section className="card">
            <p className="eyebrow">Workflow Progress</p>
            <ol className="workflow-steps" aria-label="Workflow progress">
              {workflowSteps.map((step, index) => (
                <li key={`${step.label}-${index}`} className={`workflow-step workflow-step-${step.state}`}>
                  <span className="workflow-step-index">{index + 1}</span>
                  <span>{step.label}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

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
