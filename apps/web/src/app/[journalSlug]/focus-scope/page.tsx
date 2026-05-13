import JournalNav from "../../../components/JournalNav";
import { getJournal, getPolicyLatest } from "../../../lib/api";

export default async function FocusScopePage({ params }: { params: Promise<{ journalSlug: string }> }) {
  const { journalSlug } = await params;
  const journal = await getJournal(journalSlug);

  let contentHtml: string | null = null;
  try {
    const policy = await getPolicyLatest(journalSlug, "focus-scope");
    contentHtml = policy.contentHtml;
  } catch {
    contentHtml = null;
  }

  return (
    <main className="main-stack">
      <JournalNav journalSlug={journalSlug} journalTitle={journal.title} />
      <section className="compact-hero">
        <p className="section-label">Journal Scope</p>
        <h2>Focus & Scope</h2>
        <p>Subject boundaries, research themes, and submission relevance for authors and reviewers.</p>
        <div className="metadata-badges">
          <span className="metadata-badge">Peer Reviewed</span>
          <span className="metadata-badge">Open Access</span>
          <span className="metadata-badge">Launched 2024</span>
          <span className="metadata-badge">Article-driven Publishing</span>
        </div>
      </section>

      <section className="two-col">
        <article className="content-card">
          <h3>Journal Summary</h3>
          <p>{journal.description ?? "Journal description will be published here once configured."}</p>
          <ul className="readable-list">
            <li>Subject Area: Scientific, technical, and medical research domains.</li>
            <li>Article Types: Original research, review papers, case studies, and short communications.</li>
            <li>Launch Year: 2024</li>
            <li>Publishing Model: Open access with editorial quality checks.</li>
          </ul>
        </article>
        <article className="content-card">
          <h3>Focus Areas</h3>
          <div className="focus-grid">
            <section className="focus-area-card">
              <h4>Environmental Sustainability</h4>
              <p>Climate resilience, circular systems, energy transition, and ecosystem stewardship.</p>
            </section>
            <section className="focus-area-card">
              <h4>Social Sustainability</h4>
              <p>Inclusive policy, health equity, social impact evaluation, and community development.</p>
            </section>
            <section className="focus-area-card">
              <h4>Sustainable Development</h4>
              <p>Interdisciplinary research aligned with global development goals and real-world implementation.</p>
            </section>
          </div>
        </article>
      </section>

      <section className="content-card">
        <h3>Published Policy Text</h3>
        {contentHtml ? (
          <article className="policy-html" dangerouslySetInnerHTML={{ __html: contentHtml }} />
        ) : (
          <>
            <p className="muted">
              This journal has not published a dedicated focus-and-scope policy yet. Use the overview description for now.
            </p>
          </>
        )}
      </section>

      <section className="content-card cta-section">
        <h3>Ready To Contribute?</h3>
        <p className="muted">Submit your manuscript, review author instructions, or contact the editorial office.</p>
        <div className="cta-actions">
          <a href="/register" className="button button-primary compact">Submit Manuscript</a>
          <a href={`/${journalSlug}/policies`} className="button button-ghost compact">View Author Guidelines</a>
          <a href="/about" className="button button-ghost compact">Contact Editorial Office</a>
        </div>
      </section>
    </main>
  );
}
