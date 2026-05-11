"use client";

import { useEffect, useMemo, useState } from "react";
import { apiJson } from "../../lib/clientApi";
import ErrorAlert from "../../components/ErrorAlert";

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
      .catch((err: any) => setError(err?.message ?? "Failed to load dashboard context"));
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
    <main className="main-stack">
      <section className="hero">
        <h1>Workspace Dashboard</h1>
        <p>Open the areas you can access based on your current journal roles.</p>
      </section>
      <section className="card">
        <p className="eyebrow">Role-Based Access</p>
        <h2 style={{ marginTop: 8, marginBottom: 12 }}>Available Workspaces</h2>
        <div className="grid">
          {links.map((item) => (
            <article key={item.href} className="card journal-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <div className="meta-row" style={{ marginTop: "auto" }}>
                <a className="button compact" href={item.href}>
                  Open
                </a>
              </div>
            </article>
          ))}
          {links.length === 0 ? <p className="muted">No dashboard areas available for this account yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
