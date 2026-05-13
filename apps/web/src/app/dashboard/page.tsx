"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiJson } from "../../lib/clientApi";
import { errorMessage } from "../../lib/errorMessage";
import ErrorAlert from "../../components/ErrorAlert";
import AppShell from "../../components/dashboard/AppShell";

type RoleTier = "admin" | "editorial" | "production" | "review" | "support" | "subscriber";

type NavContext = {
  authenticated: boolean;
  user?: { id: string; email: string; name: string; mfaEnabled?: boolean };
  roles?: string[];
  roleTier?: RoleTier;
  roleLevel?: number;
  tierLabel?: string;
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
    {
      tier: "admin",
      href: "/dashboard/journals",
      title: "Journal Settings",
      description: "Update journal metadata, branding, ISSNs, and required policy mappings.",
      capability: "canManageJournal",
    },
    {
      tier: "admin",
      href: "/dashboard/storage",
      title: "Storage Settings",
      description: "Configure hybrid local and external storage providers with encrypted credentials.",
      capability: "canManageJournal",
    },
    {
      tier: "admin",
      href: "/dashboard/audit",
      title: "Audit Logs",
      description: "Trace sensitive workflow actions, policy changes, and access decisions.",
      capability: "canAudit",
    },
    {
      tier: "admin",
      href: "/dashboard/security",
      title: "Security Center",
      description: "Manage MFA setup, session hardening, and staff security controls.",
      capability: "canSecurity",
    },
    {
      tier: "editorial",
      href: "/dashboard/editor",
      title: "Editorial Workspace",
      description: "Triage submissions, assign editors, invite reviewers, and record decisions.",
      capability: "canEditorial",
    },
    {
      tier: "production",
      href: "/dashboard/publishing",
      title: "Publishing Workspace",
      description: "Manage volumes/issues, assign accepted articles, and publish assets.",
      capability: "canPublishing",
    },
    {
      tier: "review",
      href: "/dashboard/reviewer",
      title: "Reviewer Workspace",
      description: "Accept invitations and submit blinded reviews with recommendations.",
      capability: "canReview",
    },
    {
      tier: "support",
      href: "/dashboard/submissions",
      title: "Author Workspace",
      description: "Create, edit, and submit manuscript drafts with autosave and guardrails.",
      capability: "canSubmit",
    },
  ];

export default function DashboardHomePage() {
  const [ctx, setCtx] = useState<NavContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiJson<NavContext>("/auth/nav-context", { method: "GET" })
      .then((value) => setCtx(value))
      .catch((err: unknown) => setError(errorMessage(err) || "Failed to load dashboard context"));
  }, []);

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
  if (!ctx) return <p>Loading dashboard...</p>;

  const quickActions = tierGroups.flatMap((group) =>
    group.items.slice(0, 1).map((item) => ({
      label: item.title,
      href: item.href,
      variant: (group.tier === "admin" ? "primary" : group.tier === "editorial" ? "secondary" : "ghost") as "primary" | "secondary" | "ghost",
    }))
  );

  return (
    <AppShell
      title="Workflow Dashboard"
      sectionLabel={ctx.tierLabel ?? "Workspace"}
      description="Choose a guided workspace based on your role tier. Higher-tier roles inherit capabilities of lower tiers."
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
    >
      {/* Role identity banner */}
      <section className="role-identity-banner">
        <div className="role-identity-info">
          <h2 className="role-identity-name">{ctx.user?.name ?? "User"}</h2>
          {primaryRoleLabel ? (
            <span className={`chip role-chip ${TIER_ACCENT[ctx.roleTier ?? "subscriber"]}`}>
              {primaryRoleLabel}
            </span>
          ) : null}
          {ctx.tierLabel ? (
            <span className="chip tier-chip">{ctx.tierLabel}</span>
          ) : null}
        </div>
        {ctx.roles && ctx.roles.length > 1 ? (
          <div className="role-identity-secondary">
            <span className="muted">Also holds:</span>{" "}
            {ctx.roles.slice(1).map((role) => (
              <span key={role} className="chip chip-small">{role}</span>
            ))}
          </div>
        ) : null}
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
