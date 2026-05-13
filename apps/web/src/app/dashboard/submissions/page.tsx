"use client";

import SubmissionComposer from "../SubmissionComposer";
import AppShell from "../../../components/dashboard/AppShell";

export default function SubmissionComposerPage() {
  return (
    <AppShell
      title="Submission Composer"
      sectionLabel="Author Support"
      description="Create and complete manuscript drafts with metadata, contributors, files, and policy acknowledgment."
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Manuscripts", href: "/dashboard/submissions" },
        { label: "New Submission", href: "/dashboard/submissions" },
      ]}
      workflowSteps={[
        { label: "Create Draft", state: "current" },
        { label: "Add Metadata", state: "upcoming" },
        { label: "Add Contributors", state: "upcoming" },
        { label: "Upload File", state: "upcoming" },
        { label: "Accept Policies", state: "upcoming" },
        { label: "Submit", state: "upcoming" },
      ]}
      quickActions={[
        { label: "Back to Dashboard", href: "/dashboard", variant: "ghost" },
      ]}
      helpTopic="Reviewer Workspace"
    >
      <SubmissionComposer />
    </AppShell>
  );
}
