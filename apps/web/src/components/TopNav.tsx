"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ApiHealthBadge from "./ApiHealthBadge";
import RoleAwareNav from "./RoleAwareNav";

export default function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 760) setMenuOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onEsc);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!mobileWrapRef.current?.contains(target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [menuOpen]);

  return (
    <>
      <nav className="site-nav site-nav-desktop">
        <ApiHealthBadge />
        <RoleAwareNav />
      </nav>
      <div className="mobile-nav-wrap" ref={mobileWrapRef}>
        <button
          type="button"
          className="button button-ghost compact nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-panel"
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? "Close" : "Menu"}
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div 
              id="mobile-nav-panel" 
              className="mobile-nav-panel open"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <nav
                className="site-nav-mobile"
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest("a")) setMenuOpen(false);
                }}
              >
                <ApiHealthBadge />
                <RoleAwareNav />
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
