"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Breadcrumbs from "../Breadcrumbs";
import { apiJson } from "../../lib/clientApi";

type RoleTier = "admin" | "editorial" | "production" | "review" | "support" | "subscriber";

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
  roleTier?: RoleTier;
  tierLabel?: string;
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

type NavItem = { label: string; href: string; capability?: string; tier: RoleTier };
type NavGroup = { tier: RoleTier; label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    tier: "admin", label: "Administration", items: [
      { label: "Journal Profile", href: "/dashboard/journals", capability: "canManageJournal", tier: "admin" },
      { label: "Policies", href: "/dashboard/journals", capability: "canManageJournal", tier: "admin" },
      { label: "Focus & Scope", href: "/dashboard/journals", capability: "canManageJournal", tier: "admin" },
      { label: "Editorial Board", href: "/dashboard/journals", capability: "canManageJournal", tier: "admin" },
      { label: "Storage Settings", href: "/dashboard/storage", capability: "canManageJournal", tier: "admin" },
      { label: "Audit Logs", href: "/dashboard/audit", capability: "canAudit", tier: "admin" },
      { label: "Security", href: "/dashboard/security", capability: "canSecurity", tier: "admin" },
    ]
  },
  {
    tier: "editorial", label: "Editorial", items: [
      { label: "New Submissions", href: "/dashboard/submissions", capability: "canSubmit", tier: "editorial" },
      { label: "Under Review", href: "/dashboard/editor", capability: "canEditorial", tier: "editorial" },
    ]
  },
  {
    tier: "production", label: "Production & Publishing", items: [
      { label: "Publishing Desk", href: "/dashboard/publishing", capability: "canPublishing", tier: "production" },
      { label: "Archive & Issues", href: "/dashboard/publishing", capability: "canPublishing", tier: "production" },
    ]
  },
  {
    tier: "review", label: "Peer Review", items: [
      { label: "Reviewer Queue", href: "/dashboard/reviewer", capability: "canReview", tier: "review" },
    ]
  },
  {
    tier: "support", label: "Author Support", items: [
      { label: "Submit Manuscript", href: "/dashboard/submissions", capability: "canSubmit", tier: "support" },
    ]
  },
];

const TIER_ACCENT: Record<RoleTier, string> = {
  admin: "tier-admin",
  editorial: "tier-editorial",
  production: "tier-production",
  review: "tier-review",
  support: "tier-support",
  subscriber: "tier-subscriber",
};

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
    const userTier = navContext?.roleTier ?? "subscriber";

    // Filter groups: show items whose capability matches, plus always show Overview
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.capability) return true;
        if (!capabilities) return false;
        return capabilities[item.capability as keyof typeof capabilities];
      }),
    })).filter((group) => group.items.length > 0);
  }, [navContext?.capabilities, navContext?.roleTier]);

  // Insert Overview group at the top (always visible)
  const allGroups = useMemo(() => [
    { tier: "admin" as RoleTier, label: "Overview", items: [{ label: "Dashboard", href: "/dashboard", capability: undefined, tier: "admin" as RoleTier }] },
    ...visibleGroups,
  ], [visibleGroups]);

  const activeHref = useMemo(() => {
    const flattened = allGroups.flatMap((group) => group.items);
    const found = flattened.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    return found?.href ?? "/dashboard";
  }, [pathname, allGroups]);

  return (
    <main className="dashboard-shell" aria-label="Dashboard workspace">
      <aside className={`dashboard-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="dashboard-brand">
          <p className="eyebrow">STM Workspace</p>
          <h2>Publishing Console</h2>
          {navContext?.tierLabel ? (
            <span className={`chip tier-sidebar-chip ${TIER_ACCENT[navContext.roleTier ?? "subscriber"]}`}>
              {navContext.tierLabel}
            </span>
          ) : null}
        </div>

        <nav className="dashboard-nav" aria-label="Primary dashboard navigation">
          {allGroups.map((group) => (
            <div key={group.label} className={`dashboard-nav-group ${TIER_ACCENT[group.tier]}`}>
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
                    <span className={`dot ${TIER_ACCENT[item.tier]}`} aria-hidden="true" />
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
                const className = `button compact ${action.variant === "primary"
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
