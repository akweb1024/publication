import type { Metadata } from "next";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Create Account | STM Journals",
  description: "Create an STM Journals account to submit manuscripts, collaborate with editors, and track publication workflows.",
  path: "/register",
  noIndex: true,
});

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
