"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type BreadcrumbItem = { label: string; href?: string };

export type ShellMeta = {
    title: string;
    description?: string;
    sectionLabel?: string;
    selectedJournalLabel?: string;
    breadcrumbItems: BreadcrumbItem[];
    workflowSteps?: Array<{ label: string; state: "complete" | "current" | "upcoming" }>;
    quickActions?: Array<{ label: string; href?: string; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger" }>;
    actions?: ReactNode;
    helpContent?: string;
    helpTopic?: string;
    journalRequired?: boolean;
};

const DEFAULT_META: ShellMeta = {
    title: "Dashboard",
    breadcrumbItems: [{ label: "Dashboard", href: "/dashboard" }],
};

const DashboardShellContext = createContext<{
    meta: ShellMeta;
    setMeta: (meta: ShellMeta) => void;
    helpOpen: boolean;
    setHelpOpen: (open: boolean) => void;
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (collapsed: boolean) => void;
}>({
    meta: DEFAULT_META,
    setMeta: () => { },
    helpOpen: false,
    setHelpOpen: () => { },
    sidebarCollapsed: false,
    setSidebarCollapsed: () => { },
});

export function useDashboardShell() {
    return useContext(DashboardShellContext);
}

export function DashboardShellProvider({ children }: { children: ReactNode }) {
    const [meta, setMetaState] = useState<ShellMeta>(DEFAULT_META);
    const [helpOpen, setHelpOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const setMeta = useCallback((next: ShellMeta) => {
        setMetaState((prev) => ({
            ...DEFAULT_META,
            ...next,
            breadcrumbItems: next.breadcrumbItems ?? prev.breadcrumbItems,
        }));
    }, []);

    return (
        <DashboardShellContext.Provider value={{ meta, setMeta, helpOpen, setHelpOpen, sidebarCollapsed, setSidebarCollapsed }}>
            {children}
        </DashboardShellContext.Provider>
    );
}