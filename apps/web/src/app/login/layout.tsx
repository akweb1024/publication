import type { Metadata } from "next";
import { createPageMetadata } from "../../lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Login | STM Journals",
  description: "Sign in to access the STM Journals editorial dashboard, submission workflows, and account controls.",
  path: "/login",
  noIndex: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
