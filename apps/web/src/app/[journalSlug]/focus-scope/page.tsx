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
      <section className="hero">
        <p className="eyebrow" style={{ color: "rgba(234, 244, 255, 0.84)" }}>
          About
        </p>
        <h1>{journal.title} — Focus & Scope</h1>
        <p>Subject boundaries, research themes, and submission relevance for authors and reviewers.</p>
      </section>



      <section className="card">
        {contentHtml ? (
          <article dangerouslySetInnerHTML={{ __html: contentHtml }} />
        ) : (
          <>
            <h2 style={{ marginBottom: 8 }}>Focus & Scope</h2>
            <p className="muted">
              This journal has not published a dedicated focus-and-scope policy yet. Use the overview description for now.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
