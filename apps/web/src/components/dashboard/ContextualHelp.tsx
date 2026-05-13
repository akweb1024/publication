"use client";

import { useState, useRef, useEffect } from "react";

type ContextualHelpProps = {
    text: string;
    children?: React.ReactNode;
};

export default function ContextualHelp({ text, children }: ContextualHelpProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    return (
        <span className="ctx-help-wrap" ref={ref}>
            <button
                type="button"
                className="ctx-help-trigger"
                aria-label="What does this mean?"
                onClick={() => setOpen((v) => !v)}
            >
                {children ?? <span className="ctx-help-icon">?</span>}
            </button>
            {open && (
                <div className="ctx-help-popup" role="tooltip">
                    <p>{text}</p>
                </div>
            )}
        </span>
    );
}