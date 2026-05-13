"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiJson } from "../../lib/clientApi";
import { errorMessage } from "../../lib/errorMessage";
import ErrorAlert from "../../components/ErrorAlert";
import AppShell from "../../components/dashboard/AppShell";

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

type WorkspaceLink = { href: string; title: string; description: string };

export default function DashboardHomePage() {
  const [ctx, setCtx] = useState<NavContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiJson<NavContext>("/auth/nav-context", { method: "GET" })
      .then((value) => setCtx(value))
      .catch((err: unknown) => setError(errorMessage(err) || "Failed to load dashboard context"));
  }, []);

  const links = useMemo<WorkspaceLink[]>(() => {
    const capabilities = ctx?.capabilities;
    if (!capabilities) return [];
    const items: WorkspaceLink[] = [];
    if (capabilities.canSubmit) {
      items.push({
        href: "/dashboard/submissions",
        title: "Author Workspace",
        description: "Create, edit, and submit manuscript drafts with autosave and guardrails.",
      });
    }
    if (capabilities.canReview) {
      items.push({
        href: "/dashboard/reviewer",
        title: "Reviewer Workspace",
        description: "Accept invitations and submit blinded reviews with recommendations.",
      });
    }
    if (capabilities.canEditorial) {
      items.push({
        href: "/dashboard/editor",
        title: "Editorial Workspace",
        description: "Triage submissions, assign editors, invite reviewers, and record decisions.",
      });
    }
    if (capabilities.canPublishing) {
      items.push({
        href: "/dashboard/publishing",
        title: "Publishing Workspace",
        description: "Manage volumes/issues, assign accepted articles, and publish assets.",
      });
    }
    if (capabilities.canManageJournal) {
      items.push({
        href: "/dashboard/journals",
        title: "Journal Settings",
        description: "Update journal metadata, branding, ISSNs, and required policy mappings.",
      });
      items.push({
        href: "/dashboard/storage",
        title: "Storage Settings",
        description: "Configure hybrid local and external storage providers with encrypted credentials.",
      });
    }
    if (capabilities.canAudit) {
      items.push({
        href: "/dashboard/audit",
        title: "Audit Logs",
        description: "Trace sensitive workflow actions, policy changes, and access decisions.",
      });
    }
    if (capabilities.canSecurity) {
      items.push({
        href: "/dashboard/security",
        title: "Security Center",
        description: "Manage MFA setup, session hardening, and staff security controls.",
      });
    }
    return items;
  }, [ctx?.capabilities]);

  if (error) return <ErrorAlert message={error} />;
  if (!ctx) return <p>Loading dashboard...</p>;

  return (
    <AppShell
      title="Workflow Dashboard"
      sectionLabel="Workspace"
      description="Choose a guided workspace based on your current role and continue where you left off."
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Overview", href: "/dashboard" },
      ]}
      workflowSteps={[
        { label: "Select Journal", state: "current" },
        { label: "Process Manuscripts", state: "upcoming" },
        { label: "Publish Articles", state: "upcoming" },
        { label: "Review Reports", state: "upcoming" },
      ]}
      quickActions={[
        { label: "Journal Setup", href: "/dashboard/journals", variant: "primary" },
        { label: "Editorial Queue", href: "/dashboard/editor", variant: "secondary" },
        { label: "Publishing Desk", href: "/dashboard/publishing", variant: "ghost" },
      ]}
    >
      <section className="dashboard-grid-three">
        {links.map((item) => (
          <article key={item.href} className="content-card">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <div style={{ marginTop: 12 }}>
              <Link className="button compact button-primary" href={item.href}>
                Open Workspace
              </Link>
            </div>
          </article>
        ))}
      </section>
      {links.length === 0 ? (
        <section className="content-card empty-state">
          <h3>No workspace modules are assigned yet</h3>
          <p className="muted">Ask an administrator to grant a journal role for this account.</p>
        </section>
      ) : null}
    </AppShell>
  );
}
