"use client";

import { useState, useEffect } from "react";

type ChecklistItem = {
    id: string;
    label: string;
    href?: string;
    completed: boolean;
};

const DEFAULT_CHECKLIST: ChecklistItem[] = [
    { id: "create-journal", label: "Create your first journal", href: "/dashboard/journals?mode=create", completed: false },
    { id: "add-issn", label: "Add ISSN/eISSN details", href: "/dashboard/journals?tab=issn", completed: false },
    { id: "add-focus", label: "Set focus & scope", href: "/dashboard/journals?tab=focus", completed: false },
    { id: "add-board", label: "Add editorial board members", href: "/dashboard/journals?tab=board", completed: false },
    { id: "add-policies", label: "Configure required policies", href: "/dashboard/journals?tab=policies", completed: false },
    { id: "enable-mfa", label: "Enable MFA for your account", href: "/dashboard/security", completed: false },
    { id: "setup-storage", label: "Configure storage settings", href: "/dashboard/storage", completed: false },
    { id: "submit-manuscript", label: "Submit a test manuscript", href: "/dashboard/submissions", completed: false },
];

export default function OnboardingChecklist() {
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem("stm-onboarding-checklist");
            if (saved) {
                const parsed = JSON.parse(saved) as ChecklistItem[];
                setItems(parsed);
                if (parsed.every((item) => item.completed)) setDismissed(true);
            } else {
                setItems(DEFAULT_CHECKLIST);
            }
            const wasDismissed = localStorage.getItem("stm-onboarding-dismissed");
            if (wasDismissed === "true") setDismissed(true);
        } catch {
            setItems(DEFAULT_CHECKLIST);
        }
    }, []);

    function toggleItem(id: string) {
        const updated = items.map((item) =>
            item.id === id ? { ...item, completed: !item.completed } : item
        );
        setItems(updated);
        try { localStorage.setItem("stm-onboarding-checklist", JSON.stringify(updated)); } catch { /* ignore */ }
        if (updated.every((item) => item.completed)) {
            setDismissed(true);
            try { localStorage.setItem("stm-onboarding-dismissed", "true"); } catch { /* ignore */ }
        }
    }

    function dismiss() {
        setDismissed(true);
        try { localStorage.setItem("stm-onboarding-dismissed", "true"); } catch { /* ignore */ }
    }

    if (dismissed || items.length === 0) return null;

    const completedCount = items.filter((item) => item.completed).length;
    const progress = Math.round((completedCount / items.length) * 100);

    return (
        <div className="onboarding-checklist">
            <div className="onboarding-header">
                <h3>🚀 Getting Started</h3>
                <div className="onboarding-progress">
                    <div className="onboarding-progress-bar" style={{ width: `${progress}%` }} />
                    <span className="onboarding-progress-label">{completedCount}/{items.length} completed</span>
                </div>
                <button type="button" className="button button-ghost compact" onClick={dismiss} aria-label="Dismiss onboarding checklist">
                    Dismiss
                </button>
            </div>
            <ul className="onboarding-items">
                {items.map((item) => (
                    <li key={item.id} className={`onboarding-item ${item.completed ? "completed" : ""}`}>
                        <button type="button" className="onboarding-check" onClick={() => toggleItem(item.id)} aria-label={item.completed ? "Mark incomplete" : "Mark complete"}>
                            {item.completed ? "✓" : "○"}
                        </button>
                        {item.href && !item.completed ? (
                            <a href={item.href} className="onboarding-item-label">{item.label}</a>
                        ) : (
                            <span className="onboarding-item-label">{item.label}</span>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}