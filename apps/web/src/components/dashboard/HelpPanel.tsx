"use client";

import { useEffect, useRef } from "react";

type HelpPanelProps = {
    open: boolean;
    onClose: () => void;
    content: string;
    title: string;
};

export default function HelpPanel({ open, onClose, content, title }: HelpPanelProps) {
    const panelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent | TouchEvent) => {
            const target = e.target as Node;
            if (panelRef.current && !panelRef.current.contains(target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handler);
        document.addEventListener("touchstart", handler);
        return () => {
            document.removeEventListener("mousedown", handler);
            document.removeEventListener("touchstart", handler);
        };
    }, [open, onClose]);

    if (!open) return null;

    /* Simple markdown-like rendering: bold with **, bullet with • */
    const renderContent = (text: string) => {
        const lines = text.split("\n");
        return lines.map((line, i) => {
            /* Bold */
            const rendered = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
            /* Bullet items */
            if (rendered.startsWith("•")) {
                return <li key={i} className="help-bullet" dangerouslySetInnerHTML={{ __html: rendered.slice(1).trim() }} />;
            }
            if (rendered.trim() === "") return <br key={i} />;
            return <p key={i} className="help-paragraph" dangerouslySetInnerHTML={{ __html: rendered }} />;
        });
    };

    return (
        <div className="help-panel-overlay" role="dialog" aria-modal="true" aria-label={`Help: ${title}`}>
            <div ref={panelRef} className="help-panel">
                <div className="help-panel-header">
                    <h3>📖 Help: {title}</h3>
                    <button type="button" className="button button-ghost compact" onClick={onClose} aria-label="Close help panel">
                        ✕
                    </button>
                </div>
                <div className="help-panel-content">
                    <ul className="help-list">{renderContent(content)}</ul>
                </div>
                <div className="help-panel-footer">
                    <p className="muted">Need more help? <a href="/dashboard/help" style={{ color: "var(--accent)", fontWeight: 600 }}>Visit Help & Support</a></p>
                </div>
            </div>
        </div>
    );
}