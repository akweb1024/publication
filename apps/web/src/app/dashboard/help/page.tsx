"use client";

import { useState } from "react";
import AppShell from "../../../components/dashboard/AppShell";
import StatusBadge from "../../../components/dashboard/StatusBadge";

type HelpTab = "guide" | "faq" | "tutorials" | "contact";

type FaqItem = { question: string; answer: string };

const FAQ_ITEMS: FaqItem[] = [
    { question: "How do I create a new journal?", answer: "Navigate to Journals → Create Journal in the sidebar. Fill in the journal slug (lowercase, hyphen-separated), title, description, and timezone. Click 'Create Journal' to save." },
    { question: "What is the ISSN format?", answer: "ISSN numbers follow the format 1234-5678. The last digit can be X (check digit). The system auto-formats as you type. Both print ISSN (pISSN) and online ISSN (eISSN) can be entered on the Journal Settings page under the ISSN Details section." },
    { question: "How do I assign an editor to a manuscript?", answer: "Go to Editorial Workflow → Assign Editors. Select a journal, find the submission in the queue, choose a handling editor from the dropdown, and click 'Assign Editor'. A review round must be started before inviting reviewers." },
    { question: "How do I invite a reviewer?", answer: "In the Editorial Workspace, after starting a review round for a submission, select a reviewer from the dropdown, optionally set respond-by and due dates, then click 'Invite Reviewer'. Make sure the respond-by date is earlier than the due date." },
    { question: "How do I publish an article?", answer: "Go to Publishing → Publish Articles. Select an accepted paper, assign it to an issue, provide the PDF file ID, then click 'Publish Article'. A confirmation modal will appear before the final publish action." },
    { question: "How do I configure external storage?", answer: "Navigate to Storage & Sync → File Storage. Configure the routing policy (local/external prefixes, default target), then set up the external provider (MinIO, S3, R2, or GCS) with endpoint, region, bucket, and credentials. Test the connection before saving." },
    { question: "How do I set up database sync?", answer: "Go to Storage & Sync → External Database Sync. Enable sync, provide the PostgreSQL connection URL, test the connection, then run a manual sync. Check the sync history for results and error messages." },
    { question: "What is the correct format for the PostgreSQL URL?", answer: "Use the full connection string: postgresql://user:password@host:5432/dbname?schema=public. This URL contains credentials and is stored encrypted at rest. Never share it publicly." },
    { question: "How do I enable MFA?", answer: "Go to Admin → Security (or Security & MFA in the sidebar). Click 'Start MFA Setup', scan the QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to enable." },
    { question: "How do I view audit logs?", answer: "Navigate to Audit & Reports → Activity Logs. Select a journal from the dropdown, and you can search/filter events by action, entity type, actor name, or email." },
    { question: "What does the completion percentage on Journal Settings mean?", answer: "The completion score tracks how much of the journal profile has been filled out. It checks: title, timezone, ISSN details, branding JSON, required policy keys, meta title, and meta description. A score of 90%+ means the profile is nearly complete." },
    { question: "How do I submit a manuscript?", answer: "Go to Manuscripts → New Submissions. Select a journal, create a draft, fill in the metadata (title, abstract, keywords, article type), add contributors, upload the manuscript file, acknowledge required policies, then submit." },
];

const TUTORIAL_ITEMS = [
    { title: "Journal Setup Workflow", steps: ["Create Journal", "Add Basic Information", "Add ISSN/eISSN Details", "Add Subject Area and Focus & Scope", "Add Editorial Board", "Add Policies", "Add Branding", "Preview Public Journal Page", "Publish Journal Profile"], icon: "📚" },
    { title: "Manuscript Processing Workflow", steps: ["New Submission", "Initial Screening", "Assign Handling Editor", "Assign Reviewers", "Collect Review Reports", "Make Editorial Decision", "Request Revision / Accept / Reject", "Move Accepted Paper to Publishing"], icon: "📝" },
    { title: "Article Publishing Workflow", steps: ["Select Accepted Paper", "Verify Article Metadata", "Select Volume", "Select Issue", "Upload Final PDF", "Add DOI / Page Numbers / Article ID", "Preview Article Page", "Publish Article", "Add to Archive"], icon: "📖" },
    { title: "Volume & Issue Management", steps: ["Select Journal", "Create Volume", "Create Issue", "Assign Articles", "Preview Issue", "Publish Issue"], icon: "📦" },
    { title: "Storage & Database Sync", steps: ["Select Journal", "Select Storage Method", "Configure External Database", "Test Connection", "Save Settings", "Run Sync", "View Sync Logs", "Resolve Errors"], icon: "💾" },
    { title: "Website Content Management", steps: ["Select Journal", "Choose Content Section", "Edit Content", "Preview Public Page", "Save Draft", "Publish Changes"], icon: "🌐" },
];

export default function HelpPage() {
    const [activeTab, setActiveTab] = useState<HelpTab>("guide");
    const [searchQuery, setSearchQuery] = useState("");

    const filteredFaqs = searchQuery.trim()
        ? FAQ_ITEMS.filter((item) => item.question.toLowerCase().includes(searchQuery.toLowerCase()) || item.answer.toLowerCase().includes(searchQuery.toLowerCase()))
        : FAQ_ITEMS;

    return (
        <AppShell
            title="Help & Support"
            sectionLabel="Help"
            description="Find guides, answers, tutorials, and support for every feature of the STM Journals Publishing Platform."
            breadcrumbItems={[
                { label: "Dashboard", href: "/dashboard" },
                { label: "Help & Support", href: "/dashboard/help" },
            ]}
            quickActions={[
                { label: "Dashboard Home", href: "/dashboard", variant: "ghost" },
            ]}
            helpContent="This is the Help & Support center. Browse the user guide, search FAQs, follow step-by-step tutorials, or contact support for assistance."
            helpTopic="Help & Support"
        >
            {/* Tab navigation */}
            <div className="shell-step-nav">
                <button type="button" className={`shell-step-nav-item ${activeTab === "guide" ? "active" : ""}`} onClick={() => setActiveTab("guide")}>
                    📖 User Guide
                </button>
                <button type="button" className={`shell-step-nav-item ${activeTab === "faq" ? "active" : ""}`} onClick={() => setActiveTab("faq")}>
                    ❓ FAQs
                </button>
                <button type="button" className={`shell-step-nav-item ${activeTab === "tutorials" ? "active" : ""}`} onClick={() => setActiveTab("tutorials")}>
                    🎓 Tutorials
                </button>
                <button type="button" className={`shell-step-nav-item ${activeTab === "contact" ? "active" : ""}`} onClick={() => setActiveTab("contact")}>
                    📞 Contact Support
                </button>
            </div>

            {/* User Guide tab */}
            {activeTab === "guide" && (
                <div className="shell-form-section">
                    <div className="shell-form-section-header">
                        <h3>📖 Platform User Guide</h3>
                    </div>
                    <p style={{ lineHeight: 1.7, color: "var(--ink-700)" }}>
                        The STM Journals Publishing Platform organizes all publishing workflows by role tier. Use the sidebar navigation to access modules relevant to your role.
                    </p>

                    <div className="shell-section-grid" style={{ marginTop: 16 }}>
                        <div className="shell-section-card">
                            <div className="shell-section-card-title">📚 Journal Management</div>
                            <p className="muted">Create and configure journals, set up ISSN details, branding, focus & scope, editorial boards, and policies.</p>
                            <StatusBadge label="Admin" tone="info" />
                        </div>
                        <div className="shell-section-card">
                            <div className="shell-section-card-title">📝 Manuscript Processing</div>
                            <p className="muted">Submit manuscripts, screen submissions, assign editors and reviewers, collect reviews, and make decisions.</p>
                            <StatusBadge label="Editorial" tone="info" />
                        </div>
                        <div className="shell-section-card">
                            <div className="shell-section-card-title">📖 Publishing</div>
                            <p className="muted">Create volumes and issues, assign accepted papers, upload PDFs, and publish articles to the archive.</p>
                            <StatusBadge label="Production" tone="info" />
                        </div>
                        <div className="shell-section-card">
                            <div className="shell-section-card-title">🔍 Peer Review</div>
                            <p className="muted">Accept review invitations, write reviews with comments and recommendations, and submit on time.</p>
                            <StatusBadge label="Review" tone="info" />
                        </div>
                        <div className="shell-section-card">
                            <div className="shell-section-card-title">💾 Storage & Sync</div>
                            <p className="muted">Configure file storage routing, external object storage, and database synchronization for integration.</p>
                            <StatusBadge label="Admin" tone="info" />
                        </div>
                        <div className="shell-section-card">
                            <div className="shell-section-card-title">🔒 Security & MFA</div>
                            <p className="muted">Enable multi-factor authentication to protect your account against unauthorized access.</p>
                            <StatusBadge label="All Users" tone="ok" />
                        </div>
                    </div>

                    <div className="shell-form-section" style={{ marginTop: 16, borderLeft: "3px solid var(--accent)" }}>
                        <h3 style={{ fontSize: "0.95rem" }}>💡 Navigation Tips</h3>
                        <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.7, color: "var(--ink-700)" }}>
                            <li>Use the <strong>left sidebar</strong> to navigate between all dashboard modules.</li>
                            <li>Use <strong>Ctrl+K</strong> (or Cmd+K on Mac) to open the global search and quickly find any page.</li>
                            <li>Click the <strong>Help button</strong> (question mark icon) in the top header or on any page to get contextual help.</li>
                            <li>The <strong>journal switcher</strong> in the sidebar and header lets you change the active journal context.</li>
                            <li>Look for <strong>&quot;What does this mean?&quot;</strong> links (question mark icons) near technical fields for inline explanations.</li>
                            <li>Workflow progress bars show your current position in multi-step processes like journal setup and publishing.</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* FAQs tab */}
            {activeTab === "faq" && (
                <div className="shell-form-section">
                    <div className="shell-form-section-header">
                        <h3>❓ Frequently Asked Questions <StatusBadge label={`${filteredFaqs.length} answers`} tone="info" /></h3>
                    </div>
                    <div className="field" style={{ marginTop: 10 }}>
                        <label htmlFor="faq-search">Search FAQs</label>
                        <input id="faq-search" className="input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Type a question or keyword..." />
                    </div>
                    <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                        {filteredFaqs.map((item, i) => (
                            <div key={i} className="shell-section-card">
                                <p style={{ fontWeight: 700, fontSize: "1rem" }}>{item.question}</p>
                                <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>{item.answer}</p>
                            </div>
                        ))}
                        {filteredFaqs.length === 0 ? (
                            <div className="empty-state">
                                <h3>No matching FAQs</h3>
                                <p className="muted">Try different keywords or browse all FAQs by clearing the search.</p>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

            {/* Tutorials tab */}
            {activeTab === "tutorials" && (
                <div className="shell-form-section">
                    <div className="shell-form-section-header">
                        <h3>🎓 Step-by-Step Tutorials</h3>
                    </div>
                    <p className="muted" style={{ marginTop: 6 }}>
                        Follow these workflows to complete major publishing processes. Each tutorial shows the required steps in order.
                    </p>
                    <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                        {TUTORIAL_ITEMS.map((tutorial) => (
                            <div key={tutorial.title} className="shell-section-card">
                                <div className="shell-section-card-title">{tutorial.icon} {tutorial.title}</div>
                                <ol style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.7, color: "var(--ink-700)" }}>
                                    {tutorial.steps.map((step, i) => (
                                        <li key={i} style={{ marginBottom: 4 }}>{step}</li>
                                    ))}
                                </ol>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Contact Support tab */}
            {activeTab === "contact" && (
                <div className="shell-form-section">
                    <div className="shell-form-section-header">
                        <h3>📞 Contact Support</h3>
                    </div>
                    <p className="muted" style={{ marginTop: 6 }}>
                        If you need help beyond the guides and FAQs, reach out to our support team.
                    </p>
                    <div className="shell-section-grid" style={{ marginTop: 16 }}>
                        <div className="shell-section-card">
                            <div className="shell-section-card-title">📧 Email Support</div>
                            <p className="muted">Send a detailed description of your issue to the platform administrator. Include your email, role, journal name, and any error messages you encountered.</p>
                        </div>
                        <div className="shell-section-card">
                            <div className="shell-section-card-title">📋 Contextual Help</div>
                            <p className="muted">Click the help button (question mark icon) on any dashboard page to get page-specific guidance. Look for &quot;What does this mean?&quot; links near technical fields.</p>
                        </div>
                        <div className="shell-section-card">
                            <div className="shell-section-card-title">🔍 Audit & Error Logs</div>
                            <p className="muted">Check the Audit & Reports section for detailed action logs. Error messages often include a Reference ID that helps support diagnose issues faster.</p>
                        </div>
                    </div>

                    <div className="shell-form-section" style={{ marginTop: 16, borderLeft: "3px solid var(--accent)" }}>
                        <h3 style={{ fontSize: "0.95rem" }}>📝 Tips for Getting Faster Support</h3>
                        <ul style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.7, color: "var(--ink-700)" }}>
                            <li>Describe the <strong>exact steps</strong> you took before the problem occurred.</li>
                            <li>Copy and share the <strong>error message</strong> and Reference ID if available.</li>
                            <li>Mention your <strong>role</strong> (Admin, Editor, Reviewer, etc.) and the <strong>journal</strong> you were working on.</li>
                            <li>Specify the <strong>page URL</strong> where the issue occurred.</li>
                            <li>Let support know if the issue is <strong>reproducible</strong> (happens every time) or intermittent.</li>
                        </ul>
                    </div>
                </div>
            )}
        </AppShell>
    );
}
