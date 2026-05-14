"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Breadcrumbs from "../Breadcrumbs";
import ApiHealthBadge from "../ApiHealthBadge";
import { apiJson } from "../../lib/clientApi";
import ToastNotification from "./ToastNotification";
import HelpPanel from "./HelpPanel";

/* ── Types ── */

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
  };
};

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
  quickActions?: Array<{ label: string; href?: string; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger" }>;
  workflowSteps?: Array<{ label: string; state: "complete" | "current" | "upcoming" }>;
  helpContent?: string;
  helpTopic?: string;
  children: ReactNode;
};

/* ── Sidebar Icon SVGs ── */

const ICONS: Record<string, ReactNode> = {
  home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  journal: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>,
  manuscript: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  editorial: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>,
  publishing: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>,
  website: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>,
  storage: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>,
  audit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  admin: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  help: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  bell: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>,
  user: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  chevronDown: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>,
  chevronRight: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>,
  collapse: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>,
  expand: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>,
  logout: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
};

/* ── Sidebar Navigation Definition ── */

type NavItem = {
  label: string;
  href: string;
  icon?: string;
  capability?: string;
  badge?: string;
};

type NavGroup = {
  key: string;
  label: string;
  icon: string;
  items: NavItem[];
  defaultOpen?: boolean;
};

const SIDEBAR_NAV: NavGroup[] = [
  {
    key: "home",
    label: "Dashboard Home",
    icon: "home",
    items: [{ label: "Overview", href: "/dashboard", icon: "home" }],
    defaultOpen: true,
  },
  {
    key: "journals",
    label: "Journals",
    icon: "journal",
    items: [
      { label: "All Journals", href: "/dashboard/journals", icon: "journal", capability: "canManageJournal" },
      { label: "Create Journal", href: "/dashboard/journals?mode=create", icon: "plus", capability: "canManageJournal" },
      { label: "Journal Profile", href: "/dashboard/journals?tab=profile", icon: "journal", capability: "canManageJournal" },
      { label: "ISSN Details", href: "/dashboard/journals?tab=issn", icon: "journal", capability: "canManageJournal" },
      { label: "Branding", href: "/dashboard/journals?tab=branding", icon: "journal", capability: "canManageJournal" },
      { label: "Focus & Scope", href: "/dashboard/journals?tab=focus", icon: "journal", capability: "canManageJournal" },
      { label: "Policies", href: "/dashboard/journals?tab=policies", icon: "journal", capability: "canManageJournal" },
      { label: "Editorial Board", href: "/dashboard/journals?tab=board", icon: "user", capability: "canManageJournal" },
    ],
    defaultOpen: true,
  },
  {
    key: "manuscripts",
    label: "Manuscripts",
    icon: "manuscript",
    items: [
      { label: "New Submissions", href: "/dashboard/submissions", icon: "manuscript", capability: "canSubmit" },
      { label: "Initial Screening", href: "/dashboard/editor?status=TRIAGE", icon: "manuscript", capability: "canEditorial" },
      { label: "Under Review", href: "/dashboard/editor?status=UNDER_REVIEW", icon: "manuscript", capability: "canEditorial" },
      { label: "Revision Required", href: "/dashboard/editor?status=REVISION_REQUESTED", icon: "manuscript", capability: "canEditorial" },
      { label: "Accepted", href: "/dashboard/editor?status=ACCEPTED", icon: "manuscript", capability: "canEditorial" },
      { label: "Rejected", href: "/dashboard/editor?status=REJECTED", icon: "manuscript", capability: "canEditorial" },
    ],
    defaultOpen: false,
  },
  {
    key: "editorial",
    label: "Editorial Workflow",
    icon: "editorial",
    items: [
      { label: "Assign Editors", href: "/dashboard/editor", icon: "editorial", capability: "canEditorial" },
      { label: "Assign Reviewers", href: "/dashboard/editor?action=assign-reviewer", icon: "editorial", capability: "canEditorial" },
      { label: "Review Reports", href: "/dashboard/reviewer", icon: "manuscript", capability: "canReview" },
      { label: "Editorial Decisions", href: "/dashboard/editor?action=decision", icon: "editorial", capability: "canEditorial" },
    ],
    defaultOpen: false,
  },
  {
    key: "publishing",
    label: "Publishing",
    icon: "publishing",
    items: [
      { label: "Accepted Papers", href: "/dashboard/publishing?status=IN_PRESS", icon: "publishing", capability: "canPublishing" },
      { label: "Production Pipeline", href: "/dashboard/production", icon: "editorial", capability: "canPublishing" },
      { label: "Volumes", href: "/dashboard/publishing?tab=volumes", icon: "publishing", capability: "canPublishing" },
      { label: "Issues", href: "/dashboard/publishing?tab=issues", icon: "publishing", capability: "canPublishing" },
      { label: "Article Metadata", href: "/dashboard/publishing?tab=metadata", icon: "publishing", capability: "canPublishing" },
      { label: "PDF Uploads", href: "/dashboard/publishing?tab=pdf", icon: "publishing", capability: "canPublishing" },
      { label: "Publish Articles", href: "/dashboard/publishing?tab=publish", icon: "publishing", capability: "canPublishing" },
      { label: "Archive Management", href: "/dashboard/publishing?tab=archive", icon: "publishing", capability: "canPublishing" },
    ],
    defaultOpen: false,
  },
  {
    key: "website",
    label: "Website Content",
    icon: "website",
    items: [
      { label: "About Page", href: "/dashboard/journals?tab=about", icon: "website", capability: "canManageJournal" },
      { label: "Author Guidelines", href: "/dashboard/journals?tab=author-guidelines", icon: "website", capability: "canManageJournal" },
      { label: "Reviewer Guidelines", href: "/dashboard/journals?tab=reviewer-guidelines", icon: "website", capability: "canManageJournal" },
      { label: "Ethics Policies", href: "/dashboard/journals?tab=policies", icon: "website", capability: "canManageJournal" },
      { label: "Public Journal Pages", href: "/dashboard/journals?tab=public-pages", icon: "website", capability: "canManageJournal" },
    ],
    defaultOpen: false,
  },
  {
    key: "communications",
    label: "Communications",
    icon: "bell",
    items: [
      { label: "Message Center", href: "/dashboard/communications", icon: "bell", capability: "canManageJournal" },
      { label: "Email Templates", href: "/dashboard/communications?tab=templates", icon: "bell", capability: "canManageJournal" },
      { label: "Notification Events", href: "/dashboard/communications?tab=events", icon: "audit", capability: "canManageJournal" },
    ],
    defaultOpen: false,
  },
  {
    key: "storage",
    label: "Storage & Sync",
    icon: "storage",
    items: [
      { label: "File Storage", href: "/dashboard/storage", icon: "storage", capability: "canManageJournal" },
      { label: "External Database Sync", href: "/dashboard/storage?tab=sync", icon: "storage", capability: "canManageJournal" },
      { label: "Sync History", href: "/dashboard/storage?tab=history", icon: "storage", capability: "canManageJournal" },
    ],
    defaultOpen: false,
  },
  {
    key: "audit",
    label: "Audit & Reports",
    icon: "audit",
    items: [
      { label: "Activity Logs", href: "/dashboard/audit", icon: "audit", capability: "canAudit" },
      { label: "User Actions", href: "/dashboard/audit?tab=users", icon: "audit", capability: "canAudit" },
      { label: "Manuscript Reports", href: "/dashboard/audit?tab=manuscripts", icon: "audit", capability: "canAudit" },
      { label: "Publishing Reports", href: "/dashboard/audit?tab=publishing", icon: "audit", capability: "canAudit" },
    ],
    defaultOpen: false,
  },
  {
    key: "admin",
    label: "Admin",
    icon: "admin",
    items: [
      { label: "Users", href: "/dashboard/journals?tab=users", icon: "user", capability: "canSecurity" },
      { label: "Roles & Permissions", href: "/dashboard/journals?tab=roles", icon: "admin", capability: "canSecurity" },
      { label: "Data Manager", href: "/dashboard/data", icon: "storage", capability: "canManageJournal" },
      { label: "Settings", href: "/dashboard/journals?tab=settings", icon: "editorial", capability: "canManageJournal" },
      { label: "API Health", href: "/dashboard/security", icon: "editorial", capability: "canSecurity" },
    ],
    defaultOpen: false,
  },
  {
    key: "help",
    label: "Help & Support",
    icon: "help",
    items: [
      { label: "User Guide", href: "/dashboard/help", icon: "help" },
      { label: "FAQs", href: "/dashboard/help?tab=faq", icon: "help" },
      { label: "Tutorials", href: "/dashboard/help?tab=tutorials", icon: "help" },
      { label: "Contact Support", href: "/dashboard/help?tab=contact", icon: "help" },
    ],
    defaultOpen: false,
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

/* ── AppShell Component ── */

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
  helpContent,
  helpTopic,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [navContext, setNavContext] = useState<NavContext | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "error" | "info"; message: string } | null>(null);

  /* Collapsible group state */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    SIDEBAR_NAV.forEach((g) => { initial[g.key] = g.defaultOpen ?? false; });
    return initial;
  });

  const toggleGroup = useCallback((key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  /* Load nav context */
  useEffect(() => {
    apiJson<NavContext>("/auth/nav-context", { method: "GET" })
      .then((value) => setNavContext(value))
      .catch(() => setNavContext({ authenticated: false }));
  }, []);

  /* Filter sidebar groups based on capabilities */
  const visibleGroups = useMemo(() => {
    const capabilities = navContext?.capabilities;
    return SIDEBAR_NAV.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.capability) return true;
        if (!capabilities) return false;
        return capabilities[item.capability as keyof typeof capabilities];
      }),
    })).filter((group) => group.items.length > 0);
  }, [navContext?.capabilities]);

  /* Auto-expand group containing active item */
  useEffect(() => {
    let activeGroupKey: string | null = null;
    for (const group of visibleGroups) {
      for (const item of group.items) {
        if (pathname === item.href.split("?")[0] || pathname.startsWith(item.href.split("?")[0] + "/")) {
          activeGroupKey = group.key;
          break;
        }
      }
      if (activeGroupKey) break;
    }
    if (!activeGroupKey) return;
    setOpenGroups((prev) => (
      prev[activeGroupKey] ? prev : { ...prev, [activeGroupKey]: true }
    ));
  }, [pathname, visibleGroups]);

  /* Keyboard shortcut for search */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setHelpOpen(false);
        setProfileOpen(false);
        setNotificationsOpen(false);
        setMobileNavOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  /* Close mobile nav on resize */
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 1080) setMobileNavOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* Close mobile nav on outside click */
  useEffect(() => {
    if (!mobileNavOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const sidebar = document.querySelector(".shell-sidebar");
      const toggle = document.querySelector(".shell-mobile-toggle");
      if (sidebar && !sidebar.contains(target) && toggle && !toggle.contains(target)) {
        setMobileNavOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [mobileNavOpen]);

  /* Search items for global search */
  const searchableItems = useMemo(() => {
    return visibleGroups.flatMap((group) =>
      group.items.map((item) => ({
        label: item.label,
        href: item.href,
        group: group.label,
      }))
    );
  }, [visibleGroups]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return searchableItems.filter((item) => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q));
  }, [searchQuery, searchableItems]);

  const primaryRole = navContext?.roles?.[0] ?? null;
  const primaryRoleLabel = primaryRole
    ? { JOURNAL_ADMIN: "Journal Admin", EDITOR_IN_CHIEF: "Editor-in-Chief", MANAGING_EDITOR: "Managing Editor", SECTION_EDITOR: "Section Editor", ASSOCIATE_EDITOR: "Associate Editor", PRODUCTION_EDITOR: "Production Editor", COPYEDITOR: "Copyeditor", REVIEWER: "Reviewer", AUTHOR_SUPPORT: "Author Support", SUBSCRIBER: "Subscriber" }[primaryRole] ?? primaryRole
    : null;

  const handleLogout = useCallback(async () => {
    try {
      await apiJson("/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    router.push("/login");
  }, [router]);

  const handleJournalChangeLocal = useCallback((slug: string) => {
    if (onJournalChange) onJournalChange(slug);
  }, [onJournalChange]);

  const helpContentFinal = helpContent ?? getDefaultHelpContent(title, helpTopic);

  return (
    <div className={`shell-root ${sidebarCollapsed ? "shell-collapsed" : ""} ${mobileNavOpen ? "shell-mobile-open" : ""}`}>
      {/* ── Sidebar ── */}
      <aside className={`shell-sidebar ${mobileNavOpen ? "open" : ""}`} aria-label="Primary navigation">
        {/* Brand */}
        <div className="shell-brand">
          <Link href="/dashboard" className="shell-brand-link">
            <span className="shell-brand-mark">STM</span>
            {!sidebarCollapsed && <span className="shell-brand-copy"><strong>Publishing Console</strong></span>}
          </Link>
          {navContext?.tierLabel && !sidebarCollapsed ? (
            <span className={`chip tier-sidebar-chip ${TIER_ACCENT[navContext.roleTier ?? "subscriber"]}`}>
              {navContext.tierLabel}
            </span>
          ) : null}
          <button type="button" className="shell-collapse-btn" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setSidebarCollapsed((v) => !v)}>
            {sidebarCollapsed ? ICONS.expand : ICONS.collapse}
          </button>
        </div>

        {/* Journal switcher in sidebar */}
        {journals?.length && onJournalChange && !sidebarCollapsed ? (
          <div className="shell-journal-switcher field">
            <label htmlFor="sidebar-journal-switcher">Active Journal</label>
            <select id="sidebar-journal-switcher" className="select" value={selectedJournalSlug ?? ""} onChange={(e) => handleJournalChangeLocal(e.target.value)}>
              {journals.map((j) => <option key={j.id} value={j.slug}>{j.title}</option>)}
            </select>
          </div>
        ) : null}
        {journals?.length && onJournalChange && sidebarCollapsed ? (
          <div className="shell-journal-switcher-collapsed">
            <select className="select" value={selectedJournalSlug ?? ""} onChange={(e) => handleJournalChangeLocal(e.target.value)} aria-label="Switch journal">
              {journals.map((j) => <option key={j.id} value={j.slug}>{j.title}</option>)}
            </select>
          </div>
        ) : null}

        {/* Navigation groups */}
        <nav className="shell-nav" aria-label="Dashboard navigation">
          {visibleGroups.map((group) => {
            const isExpanded = openGroups[group.key];
            const hasActive = group.items.some((item) => pathname === item.href.split("?")[0] || pathname.startsWith(item.href.split("?")[0] + "/"));
            return (
              <div key={group.key} className={`shell-nav-group ${hasActive ? "has-active" : ""}`}>
                <button type="button" className={`shell-nav-group-toggle ${isExpanded ? "expanded" : ""}`} onClick={() => toggleGroup(group.key)} aria-expanded={isExpanded}>
                  <span className="shell-nav-group-icon">{ICONS[group.icon]}</span>
                  {!sidebarCollapsed && <span className="shell-nav-group-label">{group.label}</span>}
                  {!sidebarCollapsed && <span className="shell-nav-group-chevron">{isExpanded ? ICONS.chevronDown : ICONS.chevronRight}</span>}
                </button>
                {isExpanded && !sidebarCollapsed && (
                  <div className="shell-nav-group-items">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href.split("?")[0] || pathname.startsWith(item.href.split("?")[0] + "/") || pathname === item.href;
                      return (
                        <Link key={item.href} href={item.href} className={`shell-nav-item ${isActive ? "active" : ""}`} onClick={() => setMobileNavOpen(false)}>
                          {item.icon && <span className="shell-nav-item-icon">{ICONS[item.icon]}</span>}
                          <span>{item.label}</span>
                          {item.badge && <span className="shell-nav-item-badge">{item.badge}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
                {isExpanded && sidebarCollapsed && (
                  <div className="shell-nav-group-items-collapsed">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href.split("?")[0] || pathname.startsWith(item.href.split("?")[0] + "/") || pathname === item.href;
                      return (
                        <Link key={item.href} href={item.href} className={`shell-nav-item-icon-only ${isActive ? "active" : ""}`} title={item.label} onClick={() => setMobileNavOpen(false)}>
                          {item.icon && <span className="shell-nav-item-icon">{ICONS[item.icon]}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="shell-sidebar-footer">
          <Link href="/dashboard/help" className="shell-nav-item" onClick={() => setMobileNavOpen(false)}>
            <span className="shell-nav-item-icon">{ICONS.help}</span>
            {!sidebarCollapsed && <span>Help & Support</span>}
          </Link>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <section className="shell-main">
        {/* ── Top header ── */}
        <header className="shell-header">
          <div className="shell-header-left">
            <button type="button" className="shell-mobile-toggle button button-ghost compact" aria-label="Open dashboard navigation" onClick={() => setMobileNavOpen((v) => !v)}>
              {ICONS.collapse}
            </button>
            <Breadcrumbs items={breadcrumbItems} />
          </div>

          <div className="shell-header-center">
            {journals?.length && onJournalChange ? (
              <div className="shell-header-journal field">
                <label htmlFor="header-journal-switcher" className="sr-only">Active Journal</label>
                <select id="header-journal-switcher" className="select" value={selectedJournalSlug ?? ""} onChange={(e) => handleJournalChangeLocal(e.target.value)}>
                  {journals.map((j) => <option key={j.id} value={j.slug}>{j.title}</option>)}
                </select>
              </div>
            ) : null}
          </div>

          <div className="shell-header-right">
            {/* Global search */}
            <div className="shell-search-wrap">
              <button type="button" className="shell-header-action" aria-label="Search (Ctrl+K)" onClick={() => setSearchOpen((v) => !v)}>
                {ICONS.search}
              </button>
              {searchOpen && (
                <div className="shell-search-dropdown" role="search">
                  <div className="field">
                    <label htmlFor="global-search" className="sr-only">Search dashboard</label>
                    <input id="global-search" className="input" placeholder="Search pages, actions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus />
                  </div>
                  {searchResults.length > 0 ? (
                    <ul className="shell-search-results">
                      {searchResults.map((r) => (
                        <li key={r.href}>
                          <Link href={r.href} className="shell-search-result-item" onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                            <span className="shell-search-result-group">{r.group}</span>
                            <span>{r.label}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : searchQuery.trim() ? (
                    <p className="shell-search-empty muted">No results found.</p>
                  ) : null}
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="shell-notifications-wrap">
              <button type="button" className="shell-header-action" aria-label="Notifications" onClick={() => setNotificationsOpen((v) => !v)}>
                {ICONS.bell}
              </button>
              {notificationsOpen && (
                <div className="shell-dropdown shell-notifications-dropdown" role="dialog" aria-label="Notifications">
                  <p className="eyebrow">Notifications</p>
                  <p className="muted" style={{ padding: 12 }}>No new notifications.</p>
                </div>
              )}
            </div>

            {/* Help button */}
            <button type="button" className="shell-header-action shell-help-btn" aria-label="Help" onClick={() => setHelpOpen((v) => !v)}>
              {ICONS.help}
            </button>

            {/* API Health */}
            <div className="shell-api-health">
              <ApiHealthBadge />
            </div>

            {/* User profile */}
            <div className="shell-profile-wrap">
              <button type="button" className="shell-header-action shell-profile-btn" aria-label="User menu" onClick={() => setProfileOpen((v) => !v)}>
                {ICONS.user}
                {primaryRoleLabel && !sidebarCollapsed ? <span className="shell-profile-role">{primaryRoleLabel}</span> : null}
              </button>
              {profileOpen && (
                <div className="shell-dropdown shell-profile-dropdown" role="dialog" aria-label="User profile menu">
                  <div className="shell-profile-info">
                    <p style={{ fontWeight: 700 }}>{navContext?.user?.name ?? "User"}</p>
                    <p className="muted">{navContext?.user?.email ?? ""}</p>
                    {primaryRoleLabel ? <span className={`chip ${TIER_ACCENT[navContext?.roleTier ?? "subscriber"]}`}>{primaryRoleLabel}</span> : null}
                  </div>
                  <hr style={{ border: "none", borderBottom: "1px solid var(--line)", margin: 8 }} />
                  <Link href="/dashboard/security" className="shell-dropdown-item" onClick={() => setProfileOpen(false)}>
                    {ICONS.admin} <span>Security & MFA</span>
                  </Link>
                  <button type="button" className="shell-dropdown-item" onClick={handleLogout}>
                    {ICONS.logout} <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Page header ── */}
        <section className="shell-page-header" aria-label="Page header">
          <div className="shell-page-header-left">
            {sectionLabel && <p className="eyebrow">{sectionLabel}</p>}
            <h1>{title}</h1>
            {description && <p className="shell-page-desc">{description}</p>}
            {selectedJournalLabel && <span className="chip" style={{ marginTop: 6, display: "inline-flex" }}>📚 {selectedJournalLabel}</span>}
          </div>
          <div className="shell-page-header-right">
            {quickActions?.length ? (
              <div className="shell-quick-actions">
                {quickActions.map((action) => {
                  const cls = `button compact ${action.variant === "primary" ? "button-primary" : action.variant === "danger" ? "button-danger" : action.variant === "secondary" ? "" : "button-ghost"}`;
                  if (action.href) {
                    return <Link key={action.label} href={action.href} className={cls}>{action.label}</Link>;
                  }
                  return <button key={action.label} className={cls} type="button" onClick={action.onClick}>{action.label}</button>;
                })}
              </div>
            ) : null}
            {actions}
            <button type="button" className="button button-ghost compact shell-page-help-btn" aria-label="Page help" onClick={() => setHelpOpen(true)}>
              {ICONS.help} Help
            </button>
          </div>
        </section>

        {/* ── Workflow progress ── */}
        {workflowSteps?.length ? (
          <section className="shell-workflow-bar" aria-label="Workflow progress">
            <p className="eyebrow">Workflow Progress</p>
            <ol className="workflow-steps">
              {workflowSteps.map((step, i) => (
                <li key={`${step.label}-${i}`} className={`workflow-step workflow-step-${step.state}`}>
                  <span className="workflow-step-index">{i + 1}</span>
                  <span>{step.label}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* ── Page content ── */}
        <div className="shell-page-content">{children}</div>
      </section>

      {/* ── Help panel overlay ── */}
      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        content={helpContentFinal}
        title={helpTopic ?? title}
      />

      {/* ── Toast ── */}
      {toast && (
        <ToastNotification
          open={!!toast}
          tone={toast.tone}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

/* ── Default help content generator ── */

function getDefaultHelpContent(title: string, topic?: string): string {
  const topicKey = topic ?? title;
  const HELP_MAP: Record<string, string> = {
    "Workflow Dashboard": "Welcome to the STM Journals Publishing Console. This dashboard organizes all your publishing workflows by role tier. Select a workspace module to begin working on manuscripts, editorial tasks, publishing, or administration.\n\nTip: Use Ctrl+K to search for any page quickly.",
    "Journal Settings": "This page lets you manage all aspects of your journal configuration.\n\n• **Journal Profile**: Edit title, description, and timezone.\n• **ISSN Details**: Enter print and online ISSNs in 1234-5678 format.\n• **Branding**: Customize journal appearance with JSON branding configuration.\n• **Policies**: Set required policy keys for submissions.\n• **Editorial Board**: Manage role assignments for journal staff.\n\nWorkflow: Create Journal → Add Basic Info → Add ISSN → Add Focus & Scope → Add Board → Add Policies → Add Branding → Preview → Publish Profile.",
    "Editorial Workspace": "The editorial workspace manages the manuscript processing pipeline.\n\n• **Triage**: Screen new submissions for scope and quality.\n• **Assign Editor**: Designate a handling editor to each submission.\n• **Assign Reviewer**: Invite qualified reviewers with deadlines.\n• **Start Review Round**: Formalize the peer review process.\n• **Make Decision**: Accept, reject, or request revision.\n\nWorkflow: New Submission → Screening → Assign Editor → Assign Reviewers → Collect Reports → Decision → Move to Publishing.",
    "Publishing Operations": "Manage the publishing pipeline from accepted papers to public articles.\n\n• **Volumes**: Create yearly volumes for your journal.\n• **Issues**: Create issues within volumes.\n• **Assign Articles**: Place accepted papers into specific issues.\n• **PDF Uploads**: Attach final PDF files to articles.\n• **Publish**: Make articles publicly available.\n\nWorkflow: Select Accepted Paper → Verify Metadata → Select Volume/Issue → Upload PDF → Add DOI → Preview → Publish → Archive.",
    "Reviewer Workspace": "View and manage your reviewer assignments.\n\n• **Accept/Decline**: Respond to review invitations promptly.\n• **Submit Review**: Write comments to author and editor, choose a recommendation.\n• **Deadlines**: Track respond-by and due dates.\n\nTip: Accept invitations quickly to help editors plan review rounds efficiently.",
    "Audit Logs": "Review all audit events for your journal.\n\n• **Filter by Journal**: Switch journals using the selector.\n• **Event Types**: Track policy changes, editorial decisions, role assignments, and more.\n\nUse audit logs for compliance review and incident investigation.",
    "Storage Settings": "Configure storage and database synchronization for your journal.\n\n• **File Storage**: Set local and external storage paths, choose default target.\n• **External Provider**: Configure MinIO, S3, R2, or GCS with credentials.\n• **Database Sync**: Set up external PostgreSQL connection for data synchronization.\n• **Test Connection**: Verify your external database connection before enabling sync.\n• **Run Sync**: Execute manual synchronization and view results.\n\nWorkflow: Select Journal → Configure Storage → Set External DB → Test Connection → Save → Run Sync → View Logs → Resolve Errors.",
    "Security Settings": "Manage multi-factor authentication (MFA) for your account.\n\n• **Enable MFA**: Generate a TOTP secret, scan the QR code with your authenticator app, and enter the 6-digit code.\n• **Disable MFA**: Enter a current code to remove MFA protection.\n\nMFA adds an important layer of security. We recommend enabling it for all staff accounts.",
  };
  return HELP_MAP[topicKey] ?? `This is the **${title}** page. Use the sidebar navigation to explore related modules. Press Ctrl+K to search for any page, or click the Help button for page-specific guidance.\n\nIf you need further assistance, visit Help & Support in the sidebar.`;
}
