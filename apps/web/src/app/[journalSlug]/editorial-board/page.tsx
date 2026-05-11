import JournalNav from "../../../components/JournalNav";
import { getJournal } from "../../../lib/api";

type BoardMember = { name: string; role: string; affiliation?: string; country?: string };

export default async function EditorialBoardPage({ params }: { params: Promise<{ journalSlug: string }> }) {
  const { journalSlug } = await params;
  const journal = await getJournal(journalSlug);
  const branding = (journal.brandingJson ?? {}) as Record<string, any>;
  const board = (branding.editorialBoard ?? []) as BoardMember[];
  const sourceUrl = typeof branding.sourceUrl === "string" ? branding.sourceUrl : null;

  return (
    <main className="main-stack">
      <JournalNav journalSlug={journalSlug} journalTitle={journal.title} />
      <section className="hero">
        <p className="eyebrow" style={{ color: "rgba(234, 244, 255, 0.84)" }}>
          Editorial
        </p>
        <h1>{journal.title} — Editorial Board</h1>
        <p>Editorial leadership and subject oversight for peer review quality and decision rigor.</p>
      </section>



      <section className="card">
        <h2 style={{ marginBottom: 10 }}>Board Members</h2>
        {board.length === 0 ? (
          <>
            <p className="muted">Editorial board entries are not yet configured in this environment.</p>
            {sourceUrl ? (
              <p style={{ marginTop: 10 }}>
                <a href={sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 700 }}>
                  View source journal page
                </a>
              </p>
            ) : null}
          </>
        ) : (
          <ul className="list">
            {board.map((member) => (
              <li key={`${member.role}-${member.name}`} className="list-item">
                <p style={{ fontWeight: 700 }}>{member.name}</p>
                <p className="muted">
                  {member.role}
                  {member.affiliation ? ` • ${member.affiliation}` : ""}
                  {member.country ? ` • ${member.country}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
