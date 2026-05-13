"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiJson } from "../lib/clientApi";
import { motion } from "framer-motion";

type RoleTier = "admin" | "editorial" | "production" | "review" | "support" | "subscriber";

type NavContext = {
  authenticated: boolean;
  user?: { id: string; email: string; name: string; mfaEnabled?: boolean };
  roles?: string[];
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

const ROLE_TIER: Record<string, RoleTier> = {
  JOURNAL_ADMIN: "admin",
  EDITOR_IN_CHIEF: "admin",
  MANAGING_EDITOR: "admin",
  SECTION_EDITOR: "editorial",
  ASSOCIATE_EDITOR: "editorial",
  PRODUCTION_EDITOR: "production",
  COPYEDITOR: "production",
  REVIEWER: "review",
  AUTHOR_SUPPORT: "support",
  SUBSCRIBER: "subscriber",
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

const TIER_ACCENT: Record<RoleTier, string> = {
  admin: "tier-admin",
  editorial: "tier-editorial",
  production: "tier-production",
  review: "tier-review",
  support: "tier-support",
  subscriber: "tier-subscriber",
};

/** Tier-grouped nav items definition. */
type NavTierGroup = { tier: RoleTier; label: string; items: Array<{ href: string; label: string; capability: string }> };

const NAV_TIER_GROUPS: NavTierGroup[] = [
  {
    tier: "admin",
    label: "Admin",
    items: [
      { href: "/dashboard/journals", label: "Settings", capability: "canManageJournal" },
      { href: "/dashboard/storage", label: "Storage", capability: "canManageJournal" },
      { href: "/dashboard/audit", label: "Audit", capability: "canAudit" },
      { href: "/dashboard/security", label: "Security", capability: "canSecurity" },
    ],
  },
  {
    tier: "editorial",
    label: "Editorial",
    items: [
      { href: "/dashboard/editor", label: "Editorial", capability: "canEditorial" },
    ],
  },
  {
    tier: "production",
    label: "Production",
    items: [
      { href: "/dashboard/publishing", label: "Publishing", capability: "canPublishing" },
    ],
  },
  {
    tier: "review",
    label: "Review",
    items: [
      { href: "/dashboard/reviewer", label: "Review", capability: "canReview" },
    ],
  },
  {
    tier: "support",
    label: "Author",
    items: [
      { href: "/dashboard/submissions", label: "Author", capability: "canSubmit" },
    ],
  },
];

export default function RoleAwareNav() {
  const [ctx, setCtx] = useState<NavContext>({ authenticated: false });
  const pathname = usePathname();

  useEffect(() => {
    apiJson<NavContext>("/auth/nav-context", { method: "GET" })
      .then((value) => setCtx(value))
      .catch(() => setCtx({ authenticated: false }));
  }, []);

  if (!ctx.authenticated) {
    const journalsActive = pathname === "/" || pathname === "/journals";
    return (
      <>
        <Link href="/journals" className={`nav-link ${journalsActive ? "nav-link-active" : ""}`}>
          {journalsActive && (
            <motion.div layoutId="active-pill" className="nav-pill" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
          )}
          <span style={{ position: "relative", zIndex: 2 }}>Journals Directory</span>
        </Link>
        <Link href="/about" className={`nav-link ${pathname === "/about" ? "nav-link-active" : ""}`}>
          {pathname === "/about" && (
            <motion.div layoutId="active-pill" className="nav-pill" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
          )}
          <span style={{ position: "relative", zIndex: 2 }}>About</span>
        </Link>
        <Link href="/policies" className={`nav-link ${pathname === "/policies" ? "nav-link-active" : ""}`}>
          {pathname === "/policies" && (
            <motion.div layoutId="active-pill" className="nav-pill" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
          )}
          <span style={{ position: "relative", zIndex: 2 }}>Policies</span>
        </Link>
        <Link href="/login" className="button button-primary compact">
          Login
        </Link>
      </>
    );
  }

  const capabilities = ctx.capabilities;
  const primaryRole =
    ROLE_PRIORITY.find((role) => ctx.roles?.includes(role)) ??
    (ctx.roles && ctx.roles.length > 0 ? ctx.roles[0] : null);
  const primaryRoleLabel = primaryRole ? ROLE_LABELS[primaryRole] ?? primaryRole : null;
  const primaryRoleTier = primaryRole ? ROLE_TIER[primaryRole] ?? "subscriber" : "subscriber";
  const tierAccentClass = TIER_ACCENT[primaryRoleTier];

  function isActive(href: string) {
    if (href === "/journals") return pathname === "/" || pathname === "/journals";
    return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  }

  function NavItem({ href, label }: { href: string; label: string }) {
    const active = isActive(href);
    return (
      <Link href={href} className={`nav-link ${active ? "nav-link-active" : ""}`}>
        {active && (
          <motion.div layoutId="active-pill" className="nav-pill" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
        )}
        <span style={{ position: "relative", zIndex: 2 }}>{label}</span>
      </Link>
    );
  }

  // Filter nav groups by user capabilities
  const visibleGroups = NAV_TIER_GROUPS.filter((group) =>
    group.items.some((item) => capabilities?.[item.capability as keyof typeof capabilities])
  );

  return (
    <>
      <span className="chip identity-chip" title={ctx.roles?.join(", ") || ""}>
        <strong>{ctx.user?.name ?? "User"}</strong>
      </span>
      {primaryRoleLabel ? <span className={`chip role-chip ${tierAccentClass}`}>{primaryRoleLabel}</span> : null}
      {ctx.tierLabel ? <span className="chip tier-chip">{ctx.tierLabel}</span> : null}

      <NavItem href="/journals" label="Journals Directory" />
      <NavItem href="/about" label="About" />
      <NavItem href="/policies" label="Policies" />
      <NavItem href="/dashboard" label="Dashboard" />

      {visibleGroups.length > 0 ? (
        <>
          <span className="nav-divider" />
          {visibleGroups.map((group) => {
            const visibleItems = group.items.filter(
              (item) => capabilities?.[item.capability as keyof typeof capabilities]
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.tier} className={`nav-tier-group ${group.tier}`}>
                <span className="nav-tier-label">{group.label}</span>
                {visibleItems.map((item) => (
                  <NavItem key={item.href} href={item.href} label={item.label} />
                ))}
              </div>
            );
          })}
        </>
      ) : null}

      <Link href="/login" className="button button-primary compact">
        Switch Account
      </Link>
    </>
  );
}
