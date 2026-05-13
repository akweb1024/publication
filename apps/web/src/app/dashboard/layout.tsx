import type { Metadata } from "next";
import { DashboardShellProvider } from "../../components/dashboard/DashboardShellContext";

export const metadata: Metadata = {
    title: "Dashboard | STM Journals",
    description: "Manage journals, manuscripts, editorial workflows, publishing, and administration.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return <DashboardShellProvider>{children}</DashboardShellProvider>;
}