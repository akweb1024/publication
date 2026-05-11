import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { PrismaClient, JournalRole } from "@prisma/client";
import { AppModule } from "../modules/app.module.js";
import cookie from "@fastify/cookie";
import secureSession from "@fastify/secure-session";
import { ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET ??= "test-session-secret-32-bytes-min";
process.env.DATABASE_URL ??= "postgresql://pub:pub@localhost:55432/pub?schema=public";
process.env.REDIS_URL ??= "redis://localhost:56379";
process.env.S3_ENDPOINT ??= "http://localhost:59000";
process.env.S3_REGION ??= "us-east-1";
process.env.S3_ACCESS_KEY ??= "minioadmin";
process.env.S3_SECRET_KEY ??= "minioadmin";
process.env.S3_BUCKET ??= "pub";
process.env.S3_FORCE_PATH_STYLE ??= "true";

function randEmail(prefix: string) {
  return `${prefix}.${Math.random().toString(16).slice(2)}@test.local`;
}

function randSlug(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2, 8)}`;
}

async function boot() {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("/api/v1");

  await app.register(cookie as any);
  await app.register(secureSession as any, {
    key: Buffer.from((process.env.SESSION_SECRET ?? "").padEnd(32, "0").slice(0, 32)),
    cookie: { path: "/", httpOnly: true, sameSite: "lax", secure: false },
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

async function api(app: NestFastifyApplication, method: any, url: string, opts?: any) {
  const cookieHeader =
    opts?.cookies && typeof opts.cookies === "object"
      ? Object.entries(opts.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join("; ")
      : undefined;
  const res = await app.inject({
    method,
    url,
    payload: opts?.json,
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  return res;
}

function getSetCookie(res: any) {
  const setCookie = res.headers["set-cookie"];
  if (!setCookie) return [];
  return Array.isArray(setCookie) ? setCookie : [setCookie];
}

function cookieJarFromSetCookie(setCookies: string[]) {
  const jar: Record<string, string> = {};
  for (const sc of setCookies) {
    const pair = sc.split(";")[0];
    if (!pair) continue;
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const k = pair.slice(0, idx);
    const v = pair.slice(idx + 1);
    jar[k] = v;
  }
  return jar;
}

describe("API E2E (MVP)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await boot();
  });

  afterAll(async () => {
    if (app) await app.close();
    await prisma.$disconnect();
  });

  it("enforces multi-journal isolation for editor queue", async () => {
    const publisher = await prisma.publisher.create({
      data: { name: "P", defaultLocale: "en", supportEmail: "support@test.local" },
    });
    const slugA = randSlug("ja");
    const slugB = randSlug("jb");
    const ja = await prisma.journal.create({
      data: { publisherId: publisher.id, slug: slugA, title: "Journal A", status: "LIVE", requiredPolicyKeys: [] },
    });
    const jb = await prisma.journal.create({
      data: { publisherId: publisher.id, slug: slugB, title: "Journal B", status: "LIVE", requiredPolicyKeys: [] },
    });

    const adminEmail = randEmail("admin");
    const reg = await api(app, "POST", "/api/v1/auth/register", {
      json: { email: adminEmail, name: "Admin", password: "password123" },
    });
    expect(reg.statusCode).toBe(201);
    const cookies = cookieJarFromSetCookie(getSetCookie(reg));
    const adminId = JSON.parse(reg.body).id as string;

    const sess = await api(app, "GET", "/api/v1/auth/session", { cookies });
    expect(sess.statusCode).toBe(200);
    expect(JSON.parse(sess.body).id).toBe(adminId);

    await prisma.journalRoleAssignment.create({ data: { journalId: ja.id, userId: adminId, role: JournalRole.JOURNAL_ADMIN } });
    const ra = await prisma.journalRoleAssignment.findFirst({ where: { journalId: ja.id, userId: adminId, role: JournalRole.JOURNAL_ADMIN } });
    expect(ra).not.toBeNull();

    const qA = await api(app, "GET", `/api/v1/journals/${slugA}/editor/queue`, { cookies });
    expect(qA.statusCode, qA.body).toBe(200);

    const qB = await api(app, "GET", `/api/v1/journals/${slugB}/editor/queue`, { cookies });
    expect(qB.statusCode).toBe(403);
  });

  it("requires policy acceptance on submit and assigns tracking number", async () => {
    const publisher = await prisma.publisher.create({
      data: { name: "P2", defaultLocale: "en", supportEmail: "support2@test.local" },
    });
    const journalSlug = randSlug("jc");
    const journal = await prisma.journal.create({
      data: { publisherId: publisher.id, slug: journalSlug, title: "Journal C", status: "LIVE", requiredPolicyKeys: ["peer-review"] },
    });
    const doc = await prisma.policyDocument.create({ data: { journalId: journal.id, key: "peer-review", title: "Peer Review" } });
    const pv = await prisma.policyVersion.create({
      data: {
        policyDocumentId: doc.id,
        versionNumber: 1,
        effectiveFrom: new Date(Date.now() - 1000),
        contentHtml: "<p>dbl</p>",
        publishedByUserId: (await prisma.user.create({ data: { email: randEmail("pub"), name: "P", passwordHash: "x" } })).id,
      },
    });

    const active = await prisma.policyVersion.findMany({
      where: {
        policyDocument: { journalId: journal.id, key: { in: ["peer-review"] } },
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
      },
      select: { id: true },
    });
    expect(active.map((a) => a.id)).toContain(pv.id);

    const authorReg = await api(app, "POST", "/api/v1/auth/register", {
      json: { email: randEmail("author"), name: "Author", password: "password123" },
    });
    const authorCookies = cookieJarFromSetCookie(getSetCookie(authorReg));
    const authorId = JSON.parse(authorReg.body).id as string;
    const authorSess = await api(app, "GET", "/api/v1/auth/session", { cookies: authorCookies });
    expect(authorSess.statusCode).toBe(200);
    expect(JSON.parse(authorSess.body).id).toBe(authorId);

    const draft = await api(app, "POST", `/api/v1/journals/${journal.slug}/submissions`, { cookies: authorCookies });
    expect(draft.statusCode).toBe(201);
    const submissionId = JSON.parse(draft.body).id as string;

    const bad = await api(app, "POST", `/api/v1/submissions/${submissionId}/submit`, { cookies: authorCookies, json: { acceptedPolicyVersionIds: [] } });
    expect(bad.statusCode).toBe(400);

    const ok = await api(app, "POST", `/api/v1/submissions/${submissionId}/submit`, {
      cookies: authorCookies,
      json: { acceptedPolicyVersionIds: [pv.id] },
    });
    expect(ok.statusCode, ok.body).toBe(201);
    const submitted = JSON.parse(ok.body);
    const code = journalSlug.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 12);
    expect(submitted.trackingNumber).toMatch(new RegExp(`^${code}-20\\d{2}-\\d{6}$`));
  });

  it("redacts contributors for reviewers (double-blind)", async () => {
    const publisher = await prisma.publisher.create({
      data: { name: "P3", defaultLocale: "en", supportEmail: "support3@test.local" },
    });
    const journalSlug = randSlug("jd");
    const journal = await prisma.journal.create({
      data: { publisherId: publisher.id, slug: journalSlug, title: "Journal D", status: "LIVE", requiredPolicyKeys: [] },
    });

    const editorReg = await api(app, "POST", "/api/v1/auth/register", {
      json: { email: randEmail("editor"), name: "Editor", password: "password123" },
    });
    const editorCookies = cookieJarFromSetCookie(getSetCookie(editorReg));
    const editorId = JSON.parse(editorReg.body).id as string;
    const editorSess = await api(app, "GET", "/api/v1/auth/session", { cookies: editorCookies });
    expect(editorSess.statusCode).toBe(200);
    expect(JSON.parse(editorSess.body).id).toBe(editorId);
    await prisma.journalRoleAssignment.create({ data: { journalId: journal.id, userId: editorId, role: JournalRole.JOURNAL_ADMIN } });

    const authorReg = await api(app, "POST", "/api/v1/auth/register", {
      json: { email: randEmail("author2"), name: "Author2", password: "password123" },
    });
    const authorCookies = cookieJarFromSetCookie(getSetCookie(authorReg));

    const reviewerReg = await api(app, "POST", "/api/v1/auth/register", {
      json: { email: randEmail("rev"), name: "Reviewer", password: "password123" },
    });
    const reviewerCookies = cookieJarFromSetCookie(getSetCookie(reviewerReg));
    const reviewerId = JSON.parse(reviewerReg.body).id as string;
    const reviewerSess = await api(app, "GET", "/api/v1/auth/session", { cookies: reviewerCookies });
    expect(reviewerSess.statusCode).toBe(200);
    expect(JSON.parse(reviewerSess.body).id).toBe(reviewerId);

    const draft = await api(app, "POST", `/api/v1/journals/${journalSlug}/submissions`, { cookies: authorCookies });
    const submissionId = JSON.parse(draft.body).id as string;

    await api(app, "POST", `/api/v1/submissions/${submissionId}/contributors`, {
      cookies: authorCookies,
      json: { displayName: "Real Author", email: "real@author.test" },
    });

    await api(app, "POST", `/api/v1/submissions/${submissionId}/submit`, {
      cookies: authorCookies,
      json: { acceptedPolicyVersionIds: [] },
    });

    const rr = await api(app, "POST", `/api/v1/submissions/${submissionId}/start-review-round`, { cookies: editorCookies });
    const reviewRoundId = JSON.parse(rr.body).id as string;
    const inv = await api(app, "POST", `/api/v1/review-rounds/${reviewRoundId}/invite-reviewer`, {
      cookies: editorCookies,
      json: { reviewerUserId: reviewerId },
    });
    const assignmentId = JSON.parse(inv.body).id as string;

    const accept = await api(app, "POST", `/api/v1/review-assignments/${assignmentId}/respond`, {
      cookies: reviewerCookies,
      json: { response: "accept" },
    });
    expect(accept.statusCode, accept.body).toBe(201);

    const asReviewer = await api(app, "GET", `/api/v1/submissions/${submissionId}`, { cookies: reviewerCookies });
    expect(asReviewer.statusCode).toBe(200);
    expect(JSON.parse(asReviewer.body).contributors).toEqual([]);

    const asAuthor = await api(app, "GET", `/api/v1/submissions/${submissionId}`, { cookies: authorCookies });
    expect(JSON.parse(asAuthor.body).contributors.length).toBe(1);
  });
});
