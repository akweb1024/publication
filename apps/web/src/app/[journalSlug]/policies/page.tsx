import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import JournalNav from "../../../components/JournalNav";
import Breadcrumbs from "../../../components/Breadcrumbs";
import FaqSection from "../../../components/FaqSection";
import { getJournal, getPolicyLatest, listPolicies } from "../../../lib/api";

const SITE_BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const getPolicies = cache(async (journalSlug: string) => listPolicies(journalSlug));

export async function generateMetadata({ params }: { params: Promise<{ journalSlug: string }> }): Promise<Metadata> {
  const { journalSlug } = await params;
  const journal = await getJournal(journalSlug);
  const canonicalUrl = `${SITE_BASE}/${journalSlug}/policies`;
  const description = `Read current editorial governance policies and versioned policy documents for ${journal.title}.`;
  return {
    title: `${journal.title} Policies | Governance`,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      title: `${journal.title} Policies`,
      description,
      siteName: journal.title,
    },
    twitter: {
      card: "summary",
      title: `${journal.title} Policies`,
      description,
    },
  };
}

export default async function PoliciesHubPage({ params }: { params: Promise<{ journalSlug: string }> }) {
  const { journalSlug } = await params;
  const journal = await getJournal(journalSlug);
  const policies = await getPolicies(journalSlug);
  const keys = journal.requiredPolicyKeys ?? policies.map((policy) => policy.key);

  const policyDetails = await Promise.all(
    keys.map(async (key) => {
      try {
        const detail = await getPolicyLatest(journalSlug, key);
        return { key, detail };
      } catch {
        return { key, detail: null };
      }
    })
  );
  const canonicalUrl = `${SITE_BASE}/${journalSlug}/policies`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${journal.title} Policies`,
    description: `Policy hub for ${journal.title}.`,
    url: canonicalUrl,
    isPartOf: {
      "@type": "Periodical",
      name: journal.title,
      url: `${SITE_BASE}/${journalSlug}`,
    },
    hasPart: policyDetails.map(({ key, detail }) => ({
      "@type": "CreativeWork",
      name: detail?.title ?? key,
      url: `${canonicalUrl}/${key}`,
      version: detail?.versionNumber ? String(detail.versionNumber) : undefined,
      datePublished: detail?.effectiveFrom ? new Date(detail.effectiveFrom as string | Date).toISOString() : undefined,
    })),
  };

  return (
    <main className="main-stack">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <JournalNav journalSlug={journalSlug} journalTitle={journal.title} />
      <Breadcrumbs
        items={[
          { label: "Journals", href: "/journals" },
          { label: journal.title, href: `/${journalSlug}` },
          { label: "Policies" },
        ]}
      />
      <section className="hero">
        <p className="eyebrow" style={{ color: "rgba(234, 244, 255, 0.84)" }}>
          Governance
        </p>
        <h1>{journal.title} Policies</h1>
        <p>Browse current governance documents, policy versions, and effective dates.</p>
      </section>



      <section className="card">
        <h2 style={{ marginBottom: 10 }}>Policy Hub</h2>
        <div className="list" style={{ display: "flex", flexDirection: "column" }}>
          {policyDetails.map(({ key, detail }) => (
            <Link key={key} href={`/${journalSlug}/policies/${key}`} className="clickable-list-item">
              <span className="eyebrow" style={{ fontSize: "0.65rem", marginBottom: "4px" }}>{key}</span>
              <span className="clickable-title" style={{ fontSize: "1.1rem" }}>
                {detail?.title ?? key} <span aria-hidden="true">&rarr;</span>
              </span>
              {detail ? (
                <span className="muted" style={{ fontSize: "0.9rem", marginTop: "4px" }}>
                  Version {detail.versionNumber} • Effective{" "}
                  {new Date(typeof detail.effectiveFrom === "string" ? detail.effectiveFrom : detail.effectiveFrom).toLocaleDateString()}
                </span>
              ) : (
                <span className="muted" style={{ fontSize: "0.9rem", marginTop: "4px" }}>Policy content is not available yet.</span>
              )}
            </Link>
          ))}
        </div>
      </section>
      <FaqSection
        title="Journal Policy FAQs"
        items={[
          {
            question: "Which policy version is currently active?",
            answer:
              "Each policy entry displays a version number and effective date so editors and authors can follow current rules.",
          },
          {
            question: "Where can I view detailed policy text?",
            answer:
              "Select any policy item in the hub to open its full detail page with complete document content.",
          },
          {
            question: "Are policy keys stable for integrations?",
            answer:
              "Yes. Policy keys are suitable for consistent linking and machine-readable references across tools.",
          },
          {
            question: "Can policy pages be used by AI assistants?",
            answer:
              "Yes. Structured policy pages and metadata support AI summarization, retrieval, and workflow guidance.",
          },
        ]}
      />
    </main>
  );
}
