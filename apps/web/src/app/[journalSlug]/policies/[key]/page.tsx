import { getPolicyLatest, getJournal } from "../../../../lib/api";
import JournalNav from "../../../../components/JournalNav";

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ journalSlug: string; key: string }>;
}) {
  const { journalSlug, key } = await params;
  const [policy, journal] = await Promise.all([
    getPolicyLatest(journalSlug, key),
    getJournal(journalSlug)
  ]);
  const effectiveDate =
    typeof policy.effectiveFrom === "string" ? new Date(policy.effectiveFrom) : policy.effectiveFrom;

  return (
    <main className="main-stack">
      <JournalNav journalSlug={journalSlug} journalTitle={journal.title} />
      <a href={`/${journalSlug}/policies`} className="button button-ghost compact" style={{ width: "fit-content" }}>
        Back to policies
      </a>
      <section className="card">
        <p className="eyebrow">Policy Document</p>
        <h1 style={{ marginTop: 8 }}>{policy.title}</h1>
        <div className="meta-row">
          <span className="chip" style={{ background: "rgba(15, 23, 42, 0.08)", color: "#1f2937" }}>
            Key: {key}
          </span>
          <span className="chip" style={{ background: "rgba(15, 23, 42, 0.08)", color: "#1f2937" }}>
            Version {policy.versionNumber}
          </span>
          <span className="chip" style={{ background: "rgba(15, 23, 42, 0.08)", color: "#1f2937" }}>
            Effective: {effectiveDate.toLocaleDateString()}
          </span>
        </div>
      </section>
      <article className="card" dangerouslySetInnerHTML={{ __html: policy.contentHtml }} />
    </main>
  );
}
