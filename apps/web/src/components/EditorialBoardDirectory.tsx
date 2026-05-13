"use client";

import { useMemo, useState } from "react";

export type BoardMember = {
  name: string;
  role: string;
  affiliation?: string;
  country?: string;
  expertise?: string;
  orcid?: string;
  profileUrl?: string;
};

type Props = {
  members: BoardMember[];
  sourceUrl?: string | null;
};

const ROLE_FILTERS = ["All", "Editor-in-Chief", "Associate Editors", "Editorial Board Members", "Advisory Board"];

export default function EditorialBoardDirectory({ members, sourceUrl }: Props) {
  const [query, setQuery] = useState("");
  const [activeRole, setActiveRole] = useState("All");

  const filtered = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    return members.filter((member) => {
      const byRole = activeRole === "All" || member.role?.toLowerCase().includes(activeRole.toLowerCase().replace("s", ""));
      if (!byRole) return false;
      if (!lowered) return true;
      return [member.name, member.affiliation, member.country, member.expertise, member.role]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(lowered));
    });
  }, [activeRole, members, query]);

  if (members.length === 0) {
    return (
      <section className="content-card empty-state">
        <div className="empty-state-icon" aria-hidden="true">
          📚
        </div>
        <h2>Editorial board information will be available soon.</h2>
        <p className="muted">This journal is currently finalizing board roster and profile metadata.</p>
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="button button-ghost compact">
            View Source Journal Page
          </a>
        ) : null}
      </section>
    );
  }

  return (
    <section className="main-stack">
      <div className="content-card editorial-toolbar">
        <div className="field">
          <label htmlFor="editor-search">Search by name, affiliation, expertise, or country</label>
          <input
            id="editor-search"
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g., sustainability, India, University"
          />
        </div>
        <div className="editor-filters" role="tablist" aria-label="Board role filter">
          {ROLE_FILTERS.map((role) => (
            <button
              key={role}
              type="button"
              className={`button compact ${activeRole === role ? "button-primary" : "button-ghost"}`}
              role="tab"
              aria-selected={activeRole === role}
              onClick={() => setActiveRole(role)}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      <div className="editorial-grid">
        {filtered.map((member) => (
          <article key={`${member.role}-${member.name}`} className="content-card editorial-card">
            <h3>{member.name}</h3>
            <p className="metadata-text">{member.role}</p>
            <p>{member.affiliation || "Affiliation not listed"}</p>
            <p className="muted">{member.country || "Country not listed"}</p>
            {member.expertise ? <p className="muted">Expertise: {member.expertise}</p> : null}
            {member.orcid ? (
              <a href={`https://orcid.org/${member.orcid}`} target="_blank" rel="noreferrer">
                ORCID Profile
              </a>
            ) : null}
            {member.profileUrl ? (
              <a href={member.profileUrl} target="_blank" rel="noreferrer">
                Public Profile
              </a>
            ) : null}
          </article>
        ))}
      </div>
      {filtered.length === 0 ? (
        <section className="content-card empty-state">
          <h2>No board profiles match your filters.</h2>
          <p className="muted">Try a broader search term or reset to All roles.</p>
        </section>
      ) : null}
    </section>
  );
}
