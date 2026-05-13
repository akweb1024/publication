-- Verify IJMI journal data
SELECT slug, title, "issnPrint", "issnOnline", status FROM "Journal" WHERE slug='ijmi';

-- Board members
SELECT u.name, u.email, jra.role FROM "JournalRoleAssignment" jra JOIN "User" u ON jra."userId" = u.id JOIN "Journal" j ON jra."journalId" = j.id WHERE j.slug='ijmi' ORDER BY jra.role;

-- Volumes & Issues
SELECT v.year, v.number as vol_number, i.number as issue_number, i.title, i.status, i."publicationDate" FROM "Volume" v JOIN "Issue" i ON v.id = i."volumeId" JOIN "Journal" j ON v."journalId" = j.id WHERE j.slug='ijmi' ORDER BY v.year, i.number;

-- Articles
SELECT a.title, a.status, a.doi, a."articleNumber", s."trackingNumber" FROM "Article" a JOIN "Submission" s ON a."submissionId" = s.id JOIN "Journal" j ON a."journalId" = j.id WHERE j.slug='ijmi' ORDER BY s."trackingNumber";

-- Policies
SELECT pd.key, pd.title, pv."versionNumber" FROM "PolicyDocument" pd JOIN "PolicyVersion" pv ON pd.id = pv."policyDocumentId" JOIN "Journal" j ON pd."journalId" = j.id WHERE j.slug='ijmi' ORDER BY pd.key;

-- Article count
SELECT COUNT(*) as total_articles FROM "Article" a JOIN "Journal" j ON a."journalId" = j.id WHERE j.slug='ijmi';

-- Published asset count
SELECT COUNT(*) as published_assets FROM "PublishedAsset" pa JOIN "Article" a ON pa."articleId" = a.id JOIN "Journal" j ON a."journalId" = j.id WHERE j.slug='ijmi';

-- Published articles count
SELECT COUNT(*) as published_articles FROM "Article" a JOIN "Journal" j ON a."journalId" = j.id WHERE j.slug='ijmi' AND a.status='PUBLISHED';