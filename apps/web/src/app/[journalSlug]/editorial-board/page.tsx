import JournalNav from "../../../components/JournalNav";
import EditorialBoardDirectory, { type BoardMember } from "../../../components/EditorialBoardDirectory";
import { getJournal } from "../../../lib/api";

export default async function EditorialBoardPage({ params }: { params: Promise<{ journalSlug: string }> }) {
  const { journalSlug } = await params;
  const journal = await getJournal(journalSlug);
  const branding = (journal.brandingJson ?? {}) as Record<string, unknown>;
  const boardRaw = branding.editorialBoard;
  const board = Array.isArray(boardRaw) ? (boardRaw as BoardMember[]) : [];
  const sourceUrl = typeof branding.sourceUrl === "string" ? branding.sourceUrl : null;

  return (
    <main className="main-stack">
      <JournalNav journalSlug={journalSlug} journalTitle={journal.title} />
      <section className="compact-hero">
        <p className="section-label">Editorial Governance</p>
        <h2>Editorial Board</h2>
        <p>Editorial leadership and subject oversight for peer review quality and decision rigor.</p>
      </section>
      <EditorialBoardDirectory members={board} sourceUrl={sourceUrl} />
    </main>
  );
}
