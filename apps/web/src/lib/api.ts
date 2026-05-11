import { z } from "zod";

const API_BASE = process.env.API_BASE ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:4000/api/v1";

export const JournalSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  timezone: z.string(),
});

export async function listJournals() {
  const res = await fetch(`${API_BASE}/journals`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load journals: ${res.status}`);
  const json = await res.json();
  return z.object({ items: z.array(JournalSchema) }).parse(json).items;
}

export async function getJournal(slug: string) {
  const res = await fetch(`${API_BASE}/journals/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Journal not found`);
  return JournalSchema.extend({
    reviewModel: z.string().optional(),
    issnPrint: z.string().nullable().optional(),
    issnOnline: z.string().nullable().optional(),
    brandingJson: z.record(z.any()).optional(),
    requiredPolicyKeys: z.array(z.string()).optional(),
  }).parse(await res.json());
}

export async function listPolicies(slug: string) {
  const res = await fetch(`${API_BASE}/journals/${encodeURIComponent(slug)}/policies`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load policies`);
  return z.object({ items: z.array(z.object({ key: z.string(), title: z.string() })) }).parse(await res.json()).items;
}

export async function getPolicyLatest(slug: string, key: string) {
  const res = await fetch(
    `${API_BASE}/journals/${encodeURIComponent(slug)}/policies/${encodeURIComponent(key)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Policy not found`);
  return z
    .object({
      key: z.string(),
      title: z.string(),
      versionNumber: z.number(),
      effectiveFrom: z.string().or(z.date()),
      effectiveTo: z.string().or(z.date()).nullable().optional(),
      contentHtml: z.string(),
      changeNote: z.string().nullable().optional(),
    })
    .parse(await res.json());
}

export async function listVolumes(slug: string) {
  const res = await fetch(`${API_BASE}/journals/${encodeURIComponent(slug)}/volumes`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load volumes");
  return z.object({ items: z.array(z.object({ id: z.string(), year: z.number(), number: z.number() })) }).parse(await res.json()).items;
}

export async function listIssues(slug: string) {
  const res = await fetch(`${API_BASE}/journals/${encodeURIComponent(slug)}/issues`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load issues");
  return z
    .object({
      items: z.array(
        z.object({
          id: z.string(),
          volumeId: z.string(),
          number: z.number(),
          title: z.string().nullable().optional(),
          status: z.string(),
          publicationDate: z.string().nullable().optional(),
        })
      ),
    })
    .parse(await res.json()).items;
}

export async function listIssueArticles(slug: string, issueId: string) {
  const res = await fetch(`${API_BASE}/journals/${encodeURIComponent(slug)}/issues/${encodeURIComponent(issueId)}/articles`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load issue articles");
  return z
    .object({
      items: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          doi: z.string().nullable().optional(),
          status: z.string(),
          publishedAt: z.string().nullable().optional(),
          access: z.string().optional(),
        })
      ),
    })
    .parse(await res.json()).items;
}
