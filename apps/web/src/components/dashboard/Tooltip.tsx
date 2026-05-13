"use client";

import { useState, useRef, useEffect } from "react";

type TooltipProps = {
    text: string;
    children: React.ReactNode;
};

export default function Tooltip({ text, children }: TooltipProps) {
    const [show, setShow] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleEnter = () => {
        timeoutRef.current = setTimeout(() => setShow(true), 300);
    };

    const handleLeave = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setShow(false);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return (
        <span className="tooltip-wrap" onMouseEnter={handleEnter} onMouseLeave={handleLeave} onFocus={handleEnter} onBlur={handleLeave}>
            {children}
            {show && <span className="tooltip-popup" role="tooltip">{text}</span>}
        </span>
    );
}