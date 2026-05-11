"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { apiJson } from "../lib/clientApi";
import { motion } from "framer-motion";

type NavContext = {
  authenticated: boolean;
  user?: { id: string; email: string; name: string; mfaEnabled?: boolean };
  roles?: string[];
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

const ROLE_LABELS: Record<string, string> = {
  JOURNAL_ADMIN: "Journal Admin",
  EDITOR_IN_CHIEF: "Editor-in-Chief",
  MANAGING_EDITOR: "Managing Editor",
  SECTION_EDITOR: "Section Editor",
  ASSOCIATE_EDITOR: "Associate Editor",
  PRODUCTION_EDITOR: "Production Editor",
  COPYEDITOR: "Copyeditor",
  REVIEWER: "Reviewer",
  AUTHOR_SUPPORT: "Author Support",
  SUBSCRIBER: "Subscriber",
};

const ROLE_PRIORITY = [
  "JOURNAL_ADMIN",
  "EDITOR_IN_CHIEF",
  "MANAGING_EDITOR",
  "SECTION_EDITOR",
  "ASSOCIATE_EDITOR",
  "PRODUCTION_EDITOR",
  "COPYEDITOR",
  "REVIEWER",
  "AUTHOR_SUPPORT",
  "SUBSCRIBER",
] as const;

export default function RoleAwareNav() {
  const [ctx, setCtx] = useState<NavContext>({ authenticated: false });
  const pathname = usePathname();

  useEffect(() => {
    apiJson<NavContext>("/auth/nav-context", { method: "GET" })
      .then((value) => setCtx(value))
      .catch(() => setCtx({ authenticated: false }));
  }, []);

  if (!ctx.authenticated) {
    return (
      <>
        <a href="/" className={`nav-link ${pathname === "/" ? "nav-link-active" : ""}`}>
          {pathname === "/" && (
            <motion.div layoutId="active-pill" className="nav-pill" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
          )}
          <span style={{ position: "relative", zIndex: 2 }}>Journals</span>
        </a>
        <a href="/about" className={`nav-link ${pathname === "/about" ? "nav-link-active" : ""}`}>
          {pathname === "/about" && (
            <motion.div layoutId="active-pill" className="nav-pill" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
          )}
          <span style={{ position: "relative", zIndex: 2 }}>About</span>
        </a>
        <a href="/policies" className={`nav-link ${pathname === "/policies" ? "nav-link-active" : ""}`}>
          {pathname === "/policies" && (
            <motion.div layoutId="active-pill" className="nav-pill" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
          )}
          <span style={{ position: "relative", zIndex: 2 }}>Policies</span>
        </a>
        <a href="/login" className="button button-ghost compact">
          Login
        </a>
      </>
    );
  }

  const capabilities = ctx.capabilities;
  const primaryRole =
    ROLE_PRIORITY.find((role) => ctx.roles?.includes(role)) ??
    (ctx.roles && ctx.roles.length > 0 ? ctx.roles[0] : null);
  const primaryRoleLabel = primaryRole ? ROLE_LABELS[primaryRole] ?? primaryRole : null;
  
  function isActive(href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  }

  function NavItem({ href, label }: { href: string; label: string }) {
    const active = isActive(href);
    return (
      <a href={href} className={`nav-link ${active ? "nav-link-active" : ""}`}>
        {active && (
          <motion.div layoutId="active-pill" className="nav-pill" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
        )}
        <span style={{ position: "relative", zIndex: 2 }}>{label}</span>
      </a>
    );
  }

  return (
    <>
      <span className="chip identity-chip" title={ctx.roles?.join(", ") || ""}>
        <strong>{ctx.user?.name ?? "User"}</strong>
      </span>
      {primaryRoleLabel ? <span className="chip role-chip">{primaryRoleLabel}</span> : null}
      
      <NavItem href="/" label="Journals" />
      <NavItem href="/about" label="About" />
      <NavItem href="/policies" label="Policies" />
      
      {capabilities?.canSubmit ? <NavItem href="/dashboard/submissions" label="Author" /> : null}
      {capabilities?.canReview ? <NavItem href="/dashboard/reviewer" label="Review" /> : null}
      {capabilities?.canEditorial ? <NavItem href="/dashboard/editor" label="Editorial" /> : null}
      {capabilities?.canPublishing ? <NavItem href="/dashboard/publishing" label="Publishing" /> : null}
      
      {capabilities?.canAudit || capabilities?.canManageJournal ? (
        <>
          <span className="nav-divider" />
          {capabilities?.canAudit ? <NavItem href="/dashboard/audit" label="Audit" /> : null}
          {capabilities?.canManageJournal ? <NavItem href="/dashboard/journals" label="Admin" /> : null}
        </>
      ) : null}
      {capabilities?.canSecurity ? <NavItem href="/dashboard/security" label="Security" /> : null}
      
      <a href="/login" className="button button-ghost compact">
        Switch Account
      </a>
    </>
  );
}
