"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiJson } from "../../lib/clientApi";
import { errorMessage } from "../../lib/errorMessage";
import ErrorAlert from "../../components/ErrorAlert";
import AppShell from "../../components/dashboard/AppShell";
import StatusBadge from "../../components/dashboard/StatusBadge";
import SkeletonBlock from "../../components/dashboard/SkeletonBlock";
import OnboardingChecklist from "../../components/dashboard/OnboardingChecklist";
import ApiHealthBadge from "../../components/ApiHealthBadge";

type RoleTier = "admin" | "editorial" | "production" | "review" | "support" | "subscriber";

type NavContext = {
  authenticated: boolean;
  user?: { id: string; email: string; name: string; mfaEnabled?: boolean };
  roles?: string[];
  roleTier?: RoleTier;
  tierLabel?: string;
  roleLevel?: number;
  capabilities?: {
    canSubmit: boolean;
    canReview: boolean;
    canEditorial: boolean;
    canPublishing: boolean;
    canManageJournal: boolean;
    canAudit: boolean;
    canSecurity: boolean;
    hasRestrictedAccess: boolean;
  };
};

type JournalSummary = { id: string; slug: string; title: string; description?: string | null };

type StatItem = { label: string; value: number; icon: string; hint?: string; href?: string; tone?: "ok" | "warn" | "danger" | "info" | "neutral" };

type TierGroup = {
  tier: RoleTier;
  label: string;
  accent: string;
  items: WorkspaceLink[];
};

type WorkspaceLink = { href: string; title: string; description: string; icon?: string };

const TIER_ORDER: RoleTier[] = ["admin", "editorial", "production", "review", "support", "subscriber"];

const TIER_ACCENT: Record<RoleTier, string> = {
  admin: "tier-admin",
  editorial: "tier-editorial",
  production: "tier-production",
  review: "tier-review",
  support: "tier-support",
  subscriber: "tier-subscriber",
};

const TIER_LABEL: Record<RoleTier, string> = {
  admin: "Administration",
  editorial: "Editorial",
  production: "Production & Publishing",
  review: "Peer Review",
  support: "Author Support",
  subscriber: "Subscriber Access",
};

const WORKSPACE_ITEMS: Array<{
  tier: RoleTier;
  href: string;
  title: string;
  description: string;
  capability: keyof NonNullable<NavContext["capabilities"]>;
}> = [
    { tier: "admin", href: "/dashboard/journals", title: "Journal Settings", description: "Update journal metadata, branding, ISSNs, and required policy mappings.", capability: "canManageJournal" },
    { tier: "admin", href: "/dashboard/communications", title: "Communications Center", description: "Manage templates, outbound messages, and notification events.", capability: "canManageJournal" },
    { tier: "admin", href: "/dashboard/storage", title: "Storage Settings", description: "Configure hybrid local and external storage providers.", capability: "canManageJournal" },
    { tier: "admin", href: "/dashboard/audit", title: "Audit Logs", description: "Trace sensitive workflow actions, policy changes, and access decisions.", capability: "canAudit" },
    { tier: "admin", href: "/dashboard/security", title: "Security Center", description: "Manage MFA setup, session hardening, and staff security controls.", capability: "canSecurity" },
    { tier: "editorial", href: "/dashboard/editor", title: "Editorial Workspace", description: "Triage submissions, assign editors, invite reviewers, and record decisions.", capability: "canEditorial" },
    { tier: "production", href: "/dashboard/production", title: "Production Pipeline", description: "Run copyediting, proofing, layout, metadata QA, and final publication checks.", capability: "canPublishing" },
    { tier: "production", href: "/dashboard/publishing", title: "Publishing Workspace", description: "Manage volumes/issues, assign accepted articles, and publish assets.", capability: "canPublishing" },
    { tier: "review", href: "/dashboard/reviewer", title: "Reviewer Workspace", description: "Accept invitations and submit blinded reviews with recommendations.", capability: "canReview" },
    { tier: "support", href: "/dashboard/submissions", title: "Author Workspace", description: "Create, edit, and submit manuscript drafts with autosave and guardrails.", capability: "canSubmit" },
  ];

export default function DashboardHomePage() {
  const [ctx, setCtx] = useState<NavContext | null>(null);
  const [journals, setJournals] = useState<JournalSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      setError(null);
      try {
        const navCtx = await apiJson<NavContext>("/auth/nav-context", { method: "GET" });
        if (!mounted) return;
        setCtx(navCtx);

        /* Load journals list */
        try {
          const journalsRes = await apiJson<{ items: JournalSummary[] }>("/journals", { method: "GET" });
          if (!mounted) return;
          setJournals(journalsRes.items);
        } catch { /* journals may fail if user has no journal role */ }
      } catch (err: unknown) {
        if (!mounted) return;
        setError(errorMessage(err) || "Failed to load dashboard context");
      }
    }
    boot();
    return () => { mounted = false; };
  }, []);

  /* Build stat cards from context */
  const statCards = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];
    items.push({ label: "Total Journals", value: journals.length, icon: "📚", href: "/dashboard/journals" });
    if (ctx?.capabilities?.canSubmit) items.push({ label: "New Submissions", value: 0, icon: "📝", href: "/dashboard/submissions", hint: "Open Author Workspace" });
    if (ctx?.capabilities?.canEditorial) items.push({ label: "Papers Under Review", value: 0, icon: "🔍", href: "/dashboard/editor", hint: "Open Editorial Workspace" });
    if (ctx?.capabilities?.canEditorial) items.push({ label: "Accepted Papers", value: 0, icon: "✅", href: "/dashboard/editor?status=ACCEPTED" });
    if (ctx?.capabilities?.canPublishing) items.push({ label: "Published Articles", value: 0, icon: "📖", href: "/dashboard/publishing" });
    if (ctx?.capabilities?.canPublishing) items.push({ label: "Pending PDF Uploads", value: 0, icon: "📄", href: "/dashboard/publishing?tab=pdf", tone: "warn" });
    items.push({ label: "Active Volumes", value: 0, icon: "📦", href: "/dashboard/publishing?tab=volumes" });
    items.push({ label: "Active Issues", value: 0, icon: "📰", href: "/dashboard/publishing?tab=issues" });
    if (ctx?.capabilities?.canManageJournal) items.push({ label: "Failed Syncs", value: 0, icon: "⚠️", href: "/dashboard/storage?tab=history", tone: "danger" });
    if (ctx?.capabilities?.canSecurity) items.push({ label: "Users Pending Approval", value: 0, icon: "👤", href: "/dashboard/journals?tab=users" });
    return items;
  }, [journals, ctx?.capabilities]);

  const tierGroups = useMemo<TierGroup[]>(() => {
    const capabilities = ctx?.capabilities;
    if (!capabilities) return [];
    const groups: TierGroup[] = [];
    for (const tier of TIER_ORDER) {
      const items: WorkspaceLink[] = [];
      for (const ws of WORKSPACE_ITEMS) {
        if (ws.tier === tier && capabilities[ws.capability]) {
          items.push({ href: ws.href, title: ws.title, description: ws.description });
        }
      }
      if (items.length > 0) {
        groups.push({ tier, label: TIER_LABEL[tier], accent: TIER_ACCENT[tier], items });
      }
    }
    return groups;
  }, [ctx?.capabilities]);

  const primaryRole = ctx?.roles?.[0] ?? null;
  const primaryRoleLabel = primaryRole
    ? { JOURNAL_ADMIN: "Journal Admin", EDITOR_IN_CHIEF: "Editor-in-Chief", MANAGING_EDITOR: "Managing Editor", SECTION_EDITOR: "Section Editor", ASSOCIATE_EDITOR: "Associate Editor", PRODUCTION_EDITOR: "Production Editor", COPYEDITOR: "Copyeditor", REVIEWER: "Reviewer", AUTHOR_SUPPORT: "Author Support", SUBSCRIBER: "Subscriber" }[primaryRole] ?? primaryRole
    : null;

  if (error) return <ErrorAlert message={error} />;
  if (!ctx) return (
    <AppShell title="Loading..." breadcrumbItems={[{ label: "Dashboard", href: "/dashboard" }]} helpTopic="Workflow Dashboard">
      <SkeletonBlock height={44} />
      <SkeletonBlock height={120} />
      <SkeletonBlock height={180} />
    </AppShell>
  );

  const quickActions = tierGroups.flatMap((group) =>
    group.items.slice(0, 1).map((item) => ({
      label: item.title,
      href: item.href,
      variant: (group.tier === "admin" ? "primary" : group.tier === "editorial" ? "secondary" : "ghost") as "primary" | "secondary" | "ghost",
    }))
  );

  /* Role-based welcome message */
  const welcomeMessage = primaryRoleLabel
    ? `Welcome back, ${ctx.user?.name ?? "User"}! You are logged in as ${primaryRoleLabel}.`
    : `Welcome, ${ctx.user?.name ?? "User"}!`;

  /* Recent activity items (mock until API provides them) */
  const recentActivity = [
    { label: "Dashboard loaded", time: "Just now", dot: "#4f46e5" },
  ];

  /* Pending tasks count */
  const pendingTasks = tierGroups.length;

  return (
    <AppShell
      title="Workflow Dashboard"
      sectionLabel={ctx.tierLabel ?? "Workspace"}
      description="Your centralized workspace for journal management, manuscript processing, editorial review, and publishing operations."
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Overview", href: "/dashboard" },
      ]}
      workflowSteps={[
        { label: "Select Journal", state: "current" },
        { label: "Process Manuscripts", state: "upcoming" },
        { label: "Publish Articles", state: "upcoming" },
        { label: "Review reports", state: "upcoming" },
      ]}
      quickActions={quickActions}
      journals={journals}
      selectedJournalSlug={journals[0]?.slug}
      onJournalChange={() => { }}
      helpTopic="Workflow Dashboard"
    >
      {/* Welcome banner */}
      <div className="shell-welcome-banner">
        <div>
          <h2>{welcomeMessage}</h2>
          <p>Manage your publishing workflows from one place. Use the sidebar to navigate between modules, or start with a quick action below.</p>
          <div className="shell-welcome-actions" style={{ marginTop: 12 }}>
            {quickActions.slice(0, 3).map((action) => (
              <Link key={action.label} href={action.href ?? "/dashboard"} className={`button compact ${action.variant === "primary" ? "button-primary" : action.variant === "secondary" ? "" : "button-ghost"}`}>
                {action.label}
              </Link>
            ))}
            <Link href="/dashboard/help" className="button button-ghost compact">📖 User Guide</Link>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {primaryRoleLabel ? (
            <span className={`chip role-chip ${TIER_ACCENT[ctx.roleTier ?? "subscriber"]}`}>
              {primaryRoleLabel}
            </span>
          ) : null}
          {ctx.tierLabel ? (
            <span className="chip tier-chip" style={{ marginTop: 6 }}>{ctx.tierLabel}</span>
          ) : null}
          {ctx.roles && ctx.roles.length > 1 ? (
            <div className="role-identity-secondary" style={{ marginTop: 8 }}>
              <span className="muted">Also holds:</span>{" "}
              {ctx.roles.slice(1).map((role) => (
                <span key={role} className="chip chip-small">{role}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Onboarding checklist */}
      <OnboardingChecklist />

      {/* Statistics cards */}
      <section>
        <p className="eyebrow">Overview Statistics</p>
        <div className="shell-stats-grid">
          {statCards.map((stat) => (
            <Link key={stat.label} href={stat.href ?? "#"} className="shell-stat-card" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="shell-stat-icon">{stat.icon}</span>
              <p className="shell-stat-label">{stat.label}</p>
              <p className="shell-stat-value">{stat.value}</p>
              {stat.hint ? <p className="shell-stat-hint">{stat.hint}</p> : null}
            </Link>
          ))}
        </div>
      </section>

      {/* Alerts and warnings */}
      <section className="shell-alert-card">
        <p className="eyebrow">Alerts & Warnings</p>
        <div className="shell-alert-item info">
          <span>ℹ️</span>
          <span>No critical alerts at this time. System is operating normally.</span>
        </div>
      </section>

      {/* System health */}
      <div className="shell-health-bar">
        <ApiHealthBadge />
        <span className="muted" style={{ marginLeft: 8 }}>|</span>
        <span className="muted">MFA: {ctx.user?.mfaEnabled ? <StatusBadge label="Enabled" tone="ok" /> : <Link href="/dashboard/security" style={{ textDecoration: "none" }}><StatusBadge label="Not Enabled" tone="warn" /></Link>}</span>
        <span className="muted" style={{ marginLeft: 8 }}>|</span>
        <span className="muted">Pending tasks: {pendingTasks} workspace modules available</span>
      </div>

      {/* Manuscript status overview */}
      <section className="shell-section-card">
        <div className="shell-section-card-title">📝 Manuscript Status Overview</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge label="Submitted" tone="submitted" />
          <StatusBadge label="Under Review" tone="under-review" />
          <StatusBadge label="Revision Required" tone="revision" />
          <StatusBadge label="Accepted" tone="accepted" />
          <StatusBadge label="Rejected" tone="rejected" />
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Track manuscripts through the editorial pipeline. Visit the <Link href="/dashboard/editor" style={{ color: "var(--accent)", fontWeight: 600 }}>Editorial Workspace</Link> to manage submissions.
        </p>
      </section>

      {/* Publishing progress overview */}
      <section className="shell-section-card">
        <div className="shell-section-card-title">📖 Publishing Progress</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge label="In Press" tone="info" />
          <StatusBadge label="Published" tone="published" />
          <StatusBadge label="Pending Upload" tone="pending-upload" />
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Manage the publishing pipeline from accepted papers to public articles. Visit the <Link href="/dashboard/publishing" style={{ color: "var(--accent)", fontWeight: 600 }}>Publishing Workspace</Link>.
        </p>
      </section>

      {/* Storage/Sync status overview */}
      {ctx.capabilities?.canManageJournal ? (
        <section className="shell-section-card">
          <div className="shell-section-card-title">💾 Storage & Sync Status</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusBadge label="Not Configured" tone="not-configured" />
            <StatusBadge label="Connected" tone="connected" />
            <StatusBadge label="Sync Enabled" tone="sync-enabled" />
            <StatusBadge label="Sync Failed" tone="sync-failed" />
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Configure file storage and external database synchronization. Visit <Link href="/dashboard/storage" style={{ color: "var(--accent)", fontWeight: 600 }}>Storage & Sync</Link>.
          </p>
        </section>
      ) : null}

      {/* Recent activity */}
      <section className="shell-activity-card">
        <p className="eyebrow">Recent Activity</p>
        <ul className="shell-activity-list">
          {recentActivity.map((item, i) => (
            <li key={i} className="shell-activity-item">
              <span className="shell-activity-dot" style={{ background: item.dot }} />
              <div>
                <p>{item.label}</p>
                <p className="shell-activity-time">{item.time}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Tier-grouped workspace cards */}
      {tierGroups.map((group) => (
        <section key={group.tier} className={`tier-section ${group.accent}`}>
          <div className="tier-header">
            <h3 className="tier-title">{group.label}</h3>
            <span className="tier-badge">{group.tier.toUpperCase()}</span>
          </div>
          <div className="dashboard-grid-three">
            {group.items.map((item) => (
              <article key={item.href} className="content-card tier-card">
                <h4>{item.title}</h4>
                <p>{item.description}</p>
                <div style={{ marginTop: 12 }}>
                  <Link className="button compact button-primary" href={item.href}>
                    Open Workspace
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {tierGroups.length === 0 ? (
        <section className="content-card empty-state">
          <h3>No workspace modules are assigned yet</h3>
          <p className="muted">Ask an administrator to grant a journal role for this account.</p>
        </section>
      ) : null}

      {/* Hierarchy explainer */}
      {tierGroups.length > 1 ? (
        <section className="hierarchy-explainer">
          <h4>Role Hierarchy</h4>
          <p className="muted">
            Your roles span multiple tiers. Higher-tier roles (e.g. Admin) automatically inherit
            capabilities from lower tiers (e.g. Reviewer, Author). You only need to open a
            lower-tier workspace when you want its specialized interface.
          </p>
          <div className="hierarchy-chain">
            {TIER_ORDER.filter((t) => tierGroups.some((g) => g.tier === t)).map((tier, i, arr) => (
              <span key={tier} className={`hierarchy-node ${TIER_ACCENT[tier]}${i < arr.length - 1 ? " has-arrow" : ""}`}>
                {TIER_LABEL[tier]}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
