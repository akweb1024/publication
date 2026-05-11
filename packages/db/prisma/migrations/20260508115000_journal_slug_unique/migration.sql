-- Ensure journal slugs are globally unique (routing is /{journalSlug}/...)

DROP INDEX IF EXISTS "Journal_publisherId_slug_key";
CREATE UNIQUE INDEX "Journal_slug_key" ON "Journal"("slug");

