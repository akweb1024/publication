import { PrismaClient, JournalRole, JournalStatus, SubmissionStatus } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const publisher =
    (await prisma.publisher.findFirst()) ??
    (await prisma.publisher.create({
      data: { name: "Demo Publisher", defaultLocale: "en", supportEmail: "support@publisher.local" },
    }));

  const journal =
    (await prisma.journal.findFirst({ where: { publisherId: publisher.id, slug: "demo-journal" } })) ??
    (await prisma.journal.create({
      data: {
        publisherId: publisher.id,
        slug: "demo-journal",
        title: "Demo Journal of Science",
        description: "A demo journal for local development.",
        status: JournalStatus.LIVE,
        timezone: "Asia/Kolkata",
        requiredPolicyKeys: ["peer-review"],
      },
    }));

  const adminEmail = "admin@publisher.local";
  const adminPasswordHash = await argon2.hash("admin123");
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  const admin = existingAdmin
    ? await prisma.user.update({ where: { id: existingAdmin.id }, data: { passwordHash: adminPasswordHash } })
    : await prisma.user.create({ data: { email: adminEmail, name: "Admin", passwordHash: adminPasswordHash } });

  await prisma.journalRoleAssignment.upsert({
    where: { journalId_userId_role: { journalId: journal.id, userId: admin.id, role: JournalRole.JOURNAL_ADMIN } },
    update: {},
    create: { journalId: journal.id, userId: admin.id, role: JournalRole.JOURNAL_ADMIN },
  });

  const editorEmail = "editor@publisher.local";
  const reviewerEmail = "reviewer@publisher.local";
  const authorEmail = "author@publisher.local";
  const basePasswordHash = await argon2.hash("password123");

  const editor = await prisma.user.upsert({
    where: { email: editorEmail },
    update: { passwordHash: basePasswordHash, name: "Editor User" },
    create: { email: editorEmail, name: "Editor User", passwordHash: basePasswordHash },
  });
  const reviewer = await prisma.user.upsert({
    where: { email: reviewerEmail },
    update: { passwordHash: basePasswordHash, name: "Reviewer User" },
    create: { email: reviewerEmail, name: "Reviewer User", passwordHash: basePasswordHash },
  });
  const author = await prisma.user.upsert({
    where: { email: authorEmail },
    update: { passwordHash: basePasswordHash, name: "Author User" },
    create: { email: authorEmail, name: "Author User", passwordHash: basePasswordHash },
  });

  await prisma.journalRoleAssignment.upsert({
    where: { journalId_userId_role: { journalId: journal.id, userId: editor.id, role: JournalRole.MANAGING_EDITOR } },
    update: {},
    create: { journalId: journal.id, userId: editor.id, role: JournalRole.MANAGING_EDITOR },
  });
  await prisma.journalRoleAssignment.upsert({
    where: { journalId_userId_role: { journalId: journal.id, userId: reviewer.id, role: JournalRole.REVIEWER } },
    update: {},
    create: { journalId: journal.id, userId: reviewer.id, role: JournalRole.REVIEWER },
  });

  const policyDoc =
    (await prisma.policyDocument.findFirst({
      where: { journalId: journal.id, key: "peer-review" },
      include: { versions: true },
    })) ??
    (await prisma.policyDocument.create({
      data: { journalId: journal.id, key: "peer-review", title: "Peer Review Policy" },
      include: { versions: true },
    }));

  const hasV1 = policyDoc.versions.some((v) => v.versionNumber === 1);
  if (!hasV1) {
    await prisma.policyVersion.create({
      data: {
        policyDocumentId: policyDoc.id,
        versionNumber: 1,
        effectiveFrom: new Date(),
        contentHtml: "<p>This journal uses double-blind peer review.</p>",
        publishedByUserId: admin.id,
        changeNote: "Initial policy",
      },
    });
  }

  await prisma.submission.upsert({
    where: { journalId_trackingNumber: { journalId: journal.id, trackingNumber: "DEMO-JOURNAL-2026-000001" } },
    update: {
      status: SubmissionStatus.SUBMITTED,
      manuscriptTitle: "Seeded Editorial Triage Manuscript",
      abstractText: "A seeded manuscript used for editor triage and invite flow tests.",
      articleType: "Research Article",
      submittedAt: new Date(),
    },
    create: {
      journalId: journal.id,
      submitterUserId: author.id,
      trackingNumber: "DEMO-JOURNAL-2026-000001",
      status: SubmissionStatus.SUBMITTED,
      manuscriptTitle: "Seeded Editorial Triage Manuscript",
      abstractText: "A seeded manuscript used for editor triage and invite flow tests.",
      articleType: "Research Article",
      submittedAt: new Date(),
    },
  });
  const triageSubmission = await prisma.submission.findUniqueOrThrow({
    where: { journalId_trackingNumber: { journalId: journal.id, trackingNumber: "DEMO-JOURNAL-2026-000001" } },
    select: { id: true },
  });
  await prisma.decision.deleteMany({ where: { submissionId: triageSubmission.id } });
  await prisma.editorAssignment.deleteMany({ where: { submissionId: triageSubmission.id } });
  const triageRounds = await prisma.reviewRound.findMany({
    where: { submissionId: triageSubmission.id },
    select: { id: true },
  });
  if (triageRounds.length > 0) {
    const triageRoundIds = triageRounds.map((round) => round.id);
    const triageAssignments = await prisma.reviewAssignment.findMany({
      where: { reviewRoundId: { in: triageRoundIds } },
      select: { id: true },
    });
    if (triageAssignments.length > 0) {
      await prisma.review.deleteMany({ where: { reviewAssignmentId: { in: triageAssignments.map((assignment) => assignment.id) } } });
      await prisma.reviewAssignment.deleteMany({ where: { id: { in: triageAssignments.map((assignment) => assignment.id) } } });
    }
    await prisma.reviewRound.deleteMany({ where: { id: { in: triageRoundIds } } });
  }

  const acceptedSubmission = await prisma.submission.upsert({
    where: { journalId_trackingNumber: { journalId: journal.id, trackingNumber: "DEMO-JOURNAL-2026-000099" } },
    update: {
      status: SubmissionStatus.ACCEPTED,
      manuscriptTitle: "Seeded Accepted Manuscript",
      abstractText: "A seeded accepted manuscript for publishing dashboard tests.",
      articleType: "Review",
      submittedAt: new Date(),
    },
    create: {
      journalId: journal.id,
      submitterUserId: author.id,
      trackingNumber: "DEMO-JOURNAL-2026-000099",
      status: SubmissionStatus.ACCEPTED,
      manuscriptTitle: "Seeded Accepted Manuscript",
      abstractText: "A seeded accepted manuscript for publishing dashboard tests.",
      articleType: "Review",
      submittedAt: new Date(),
    },
  });

  await prisma.article.upsert({
    where: { submissionId: acceptedSubmission.id },
    update: {
      issueId: null,
      status: "IN_PRESS",
      publishedAt: null,
    },
    create: {
      submissionId: acceptedSubmission.id,
      journalId: journal.id,
      title: "Seeded In-Press Article",
      status: "IN_PRESS",
      access: "OPEN",
    },
  });
  const seededInPressArticle = await prisma.article.findUniqueOrThrow({
    where: { submissionId: acceptedSubmission.id },
    select: { id: true },
  });
  await prisma.publishedAsset.deleteMany({ where: { articleId: seededInPressArticle.id } });

  const reviewerE2eSubmission = await prisma.submission.upsert({
    where: { journalId_trackingNumber: { journalId: journal.id, trackingNumber: "DEMO-JOURNAL-2026-REVIEW-E2E" } },
    update: {
      status: SubmissionStatus.UNDER_REVIEW,
      manuscriptTitle: "Seeded Reviewer Deterministic Manuscript",
      abstractText: "Deterministic seeded manuscript for reviewer submit-review e2e flow.",
      articleType: "Research Article",
      submittedAt: new Date(),
    },
    create: {
      journalId: journal.id,
      submitterUserId: author.id,
      trackingNumber: "DEMO-JOURNAL-2026-REVIEW-E2E",
      status: SubmissionStatus.UNDER_REVIEW,
      manuscriptTitle: "Seeded Reviewer Deterministic Manuscript",
      abstractText: "Deterministic seeded manuscript for reviewer submit-review e2e flow.",
      articleType: "Research Article",
      submittedAt: new Date(),
    },
  });

  const reviewerE2eRound = await prisma.reviewRound.upsert({
    where: { submissionId_roundNumber: { submissionId: reviewerE2eSubmission.id, roundNumber: 1 } },
    update: { endedAt: null },
    create: { submissionId: reviewerE2eSubmission.id, roundNumber: 1 },
  });

  const existingReviewerAssignment = await prisma.reviewAssignment.findFirst({
    where: { reviewRoundId: reviewerE2eRound.id, reviewerUserId: reviewer.id },
    select: { id: true },
  });
  if (existingReviewerAssignment) {
    await prisma.review.deleteMany({ where: { reviewAssignmentId: existingReviewerAssignment.id } });
    await prisma.reviewAssignment.delete({ where: { id: existingReviewerAssignment.id } });
  }

  const deterministicAssignment = await prisma.reviewAssignment.create({
    data: {
      reviewRoundId: reviewerE2eRound.id,
      reviewerUserId: reviewer.id,
      status: "INVITED",
      acceptedAt: null,
      respondBy: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      dueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.review.create({ data: { reviewAssignmentId: deterministicAssignment.id } });

  const ijsuJournal =
    (await prisma.journal.findFirst({ where: { publisherId: publisher.id, slug: "ijsu" } })) ??
    (await prisma.journal.create({
      data: {
        publisherId: publisher.id,
        slug: "ijsu",
        title: "International Journal of Sustainability",
        description:
          "Peer-reviewed journal launched in 2024 focused on interdisciplinary environmental, social, and economic sustainability research.",
        status: JournalStatus.LIVE,
        timezone: "Asia/Kolkata",
        issnOnline: "3049-1339",
        submissionEmailFrom: "support@publisher.local",
        brandingJson: {
          sourceUrl: "https://journals.stmjournals.com/ijsu/",
          abbreviation: "IJSU",
          publicationFormat: "Hybrid Open Access",
          language: "English",
          copyrightPolicy: "CC BY-NC-ND",
          publisherDisplay: "STM Journals, An imprint of Consortium e-Learning Network Pvt. Ltd.",
          doiPrefix: "10.37591/IJSU",
          issuesPerYear: 2,
          subject: "Sustainability",
          startingYear: 2024,
          sourceCapturedAt: "2026-05-08",
        },
        requiredPolicyKeys: ["peer-review", "ethics", "plagiarism", "focus-scope"],
      },
    }));

  await prisma.journalRoleAssignment.upsert({
    where: { journalId_userId_role: { journalId: ijsuJournal.id, userId: admin.id, role: JournalRole.JOURNAL_ADMIN } },
    update: {},
    create: { journalId: ijsuJournal.id, userId: admin.id, role: JournalRole.JOURNAL_ADMIN },
  });
  await prisma.journalRoleAssignment.upsert({
    where: { journalId_userId_role: { journalId: ijsuJournal.id, userId: editor.id, role: JournalRole.MANAGING_EDITOR } },
    update: {},
    create: { journalId: ijsuJournal.id, userId: editor.id, role: JournalRole.MANAGING_EDITOR },
  });
  await prisma.journalRoleAssignment.upsert({
    where: { journalId_userId_role: { journalId: ijsuJournal.id, userId: reviewer.id, role: JournalRole.REVIEWER } },
    update: {},
    create: { journalId: ijsuJournal.id, userId: reviewer.id, role: JournalRole.REVIEWER },
  });

  async function upsertJournalPolicy(journalId: string, key: string, title: string, contentHtml: string, changeNote: string) {
    const doc =
      (await prisma.policyDocument.findFirst({
        where: { journalId, key },
        include: { versions: true },
      })) ??
      (await prisma.policyDocument.create({
        data: { journalId, key, title },
        include: { versions: true },
      }));
    if (!doc.versions.some((version) => version.versionNumber === 1)) {
      await prisma.policyVersion.create({
        data: {
          policyDocumentId: doc.id,
          versionNumber: 1,
          effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
          contentHtml,
          changeNote,
          publishedByUserId: admin.id,
        },
      });
    }
  }

  await upsertJournalPolicy(
    ijsuJournal.id,
    "focus-scope",
    "Focus and Scope",
    `<h2>About the Journal</h2>
<p>The International Journal of Sustainability is a peer-reviewed online journal (launched in 2024) that publishes original research, reviews, and short communications on environmental, social, and economic sustainability.</p>
<h2>Focus Areas</h2>
<ul>
  <li><strong>Environmental sustainability:</strong> biodiversity, climate change, conservation, energy efficiency, sustainable agriculture, waste reduction, water conservation, and green technologies.</li>
  <li><strong>Social sustainability:</strong> community development, equity, inclusion, health equity, labor rights, poverty reduction, and social resilience.</li>
  <li><strong>Economic sustainability:</strong> circular economy, ESG, sustainable finance, responsible investment, and sustainable production/consumption.</li>
  <li><strong>Sustainable development:</strong> SDGs, resilient communities, sustainable infrastructure, and integrated policy frameworks.</li>
</ul>
<p><em>Source:</em> https://journals.stmjournals.com/focus-and-scope/ijsu</p>`,
    "Imported from IJSU public focus and scope page."
  );

  await upsertJournalPolicy(
    ijsuJournal.id,
    "peer-review",
    "Peer-Review Policy",
    `<h2>Peer-Review Policy</h2>
<p>IJSU uses a double-blind peer-review model to evaluate quality, validity, and originality before publication.</p>
<h3>Workflow</h3>
<ol>
  <li>Submission and editorial suitability check.</li>
  <li>Preliminary screening for scope, formatting, and ethics.</li>
  <li>Assignment to at least two independent reviewers.</li>
  <li>Reviewer recommendations (accept, minor revision, major revision, reject).</li>
  <li>Editorial decision and communication to authors.</li>
  <li>Revision, resubmission, and final publication checks.</li>
</ol>
<p><em>Source:</em> https://journals.stmjournals.com/prp/ijsu</p>`,
    "Imported from IJSU peer-review policy page."
  );

  await upsertJournalPolicy(
    ijsuJournal.id,
    "plagiarism",
    "Plagiarism Policy",
    `<h2>Plagiarism Policy</h2>
<p>IJSU enforces publication integrity checks and uses similarity screening tools. Similarity reports are reviewed under editorial policy with thresholds and case-based investigation.</p>
<ul>
  <li>Similarity analysis includes overall and single-source checks.</li>
  <li>Potential misconduct is investigated with editorial action pathways.</li>
  <li>Outcomes may include revision requests, rejection, correction, or retraction depending on severity.</li>
</ul>
<p><em>Source:</em> https://journals.stmjournals.com/plagiarism-policy/ijsu</p>`,
    "Imported from IJSU plagiarism policy page."
  );

  await upsertJournalPolicy(
    ijsuJournal.id,
    "ethics",
    "Publication Ethics and Virtue",
    `<h2>Publication Ethics and Virtue</h2>
<p>IJSU states alignment with COPE and ICMJE-style expectations for research integrity and transparent publication conduct.</p>
<ul>
  <li>Author obligations: originality, authorship integrity, disclosures, and data integrity.</li>
  <li>Reviewer/editor obligations: confidentiality, fairness, conflict management, and timely communication.</li>
  <li>Misconduct handling: complaints review, corrections/retractions/statements of concern as needed.</li>
</ul>
<p><em>Source:</em> https://journals.stmjournals.com/pev/ijsu</p>`,
    "Imported from IJSU publication ethics page."
  );

  const ijsuVolume2024 = await prisma.volume.upsert({
    where: { journalId_year_number: { journalId: ijsuJournal.id, year: 2024, number: 1 } },
    update: {},
    create: { journalId: ijsuJournal.id, year: 2024, number: 1 },
  });
  const ijsuVolume2025 = await prisma.volume.upsert({
    where: { journalId_year_number: { journalId: ijsuJournal.id, year: 2025, number: 2 } },
    update: {},
    create: { journalId: ijsuJournal.id, year: 2025, number: 2 },
  });

  const ijsuIssue2024_1 = await prisma.issue.upsert({
    where: { journalId_volumeId_number: { journalId: ijsuJournal.id, volumeId: ijsuVolume2024.id, number: 1 } },
    update: {
      title: "Sustainability Systems and Climate Adaptation",
      publicationDate: new Date("2024-06-15T00:00:00.000Z"),
      status: "PUBLISHED",
    },
    create: {
      journalId: ijsuJournal.id,
      volumeId: ijsuVolume2024.id,
      number: 1,
      title: "Sustainability Systems and Climate Adaptation",
      publicationDate: new Date("2024-06-15T00:00:00.000Z"),
      status: "PUBLISHED",
    },
  });

  const ijsuIssue2024_2 = await prisma.issue.upsert({
    where: { journalId_volumeId_number: { journalId: ijsuJournal.id, volumeId: ijsuVolume2024.id, number: 2 } },
    update: {
      title: "Green Finance and Inclusive Transitions",
      publicationDate: new Date("2024-12-10T00:00:00.000Z"),
      status: "PUBLISHED",
    },
    create: {
      journalId: ijsuJournal.id,
      volumeId: ijsuVolume2024.id,
      number: 2,
      title: "Green Finance and Inclusive Transitions",
      publicationDate: new Date("2024-12-10T00:00:00.000Z"),
      status: "PUBLISHED",
    },
  });

  const ijsuIssue2025_1 = await prisma.issue.upsert({
    where: { journalId_volumeId_number: { journalId: ijsuJournal.id, volumeId: ijsuVolume2025.id, number: 1 } },
    update: {
      title: "Resilience, Policy, and Sustainable Infrastructure",
      publicationDate: new Date("2025-06-20T00:00:00.000Z"),
      status: "PLANNED",
    },
    create: {
      journalId: ijsuJournal.id,
      volumeId: ijsuVolume2025.id,
      number: 1,
      title: "Resilience, Policy, and Sustainable Infrastructure",
      publicationDate: new Date("2025-06-20T00:00:00.000Z"),
      status: "PLANNED",
    },
  });

  async function upsertIjsuArticle(input: {
    trackingNumber: string;
    title: string;
    abstractText: string;
    keywords: string[];
    articleType: string;
    issueId?: string;
    status: "IN_PRESS" | "PUBLISHED";
    publishedAt?: string;
    doi?: string;
    articleNumber?: string;
  }) {
    const submission = await prisma.submission.upsert({
      where: { journalId_trackingNumber: { journalId: ijsuJournal.id, trackingNumber: input.trackingNumber } },
      update: {
        status: SubmissionStatus.ACCEPTED,
        manuscriptTitle: input.title,
        abstractText: input.abstractText,
        keywordsText: input.keywords,
        articleType: input.articleType,
        submittedAt: new Date("2025-01-15T00:00:00.000Z"),
      },
      create: {
        journalId: ijsuJournal.id,
        submitterUserId: author.id,
        trackingNumber: input.trackingNumber,
        status: SubmissionStatus.ACCEPTED,
        manuscriptTitle: input.title,
        abstractText: input.abstractText,
        keywordsText: input.keywords,
        articleType: input.articleType,
        submittedAt: new Date("2025-01-15T00:00:00.000Z"),
      },
    });

    await prisma.article.upsert({
      where: { submissionId: submission.id },
      update: {
        title: input.title,
        abstractText: input.abstractText,
        keywordsText: input.keywords,
        issueId: input.issueId,
        status: input.status,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
        doi: input.doi ?? null,
        articleNumber: input.articleNumber ?? null,
        access: "OPEN",
      },
      create: {
        submissionId: submission.id,
        journalId: ijsuJournal.id,
        issueId: input.issueId,
        title: input.title,
        abstractText: input.abstractText,
        keywordsText: input.keywords,
        status: input.status,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
        doi: input.doi ?? null,
        articleNumber: input.articleNumber ?? null,
        access: "OPEN",
      },
    });
  }

  await upsertIjsuArticle({
    trackingNumber: "IJSU-2024-000101",
    title: "Integrated Policy Approaches to Disaster Risk and Climate Governance",
    abstractText:
      "A cross-country review of integrated policy frameworks for climate adaptation and disaster risk reduction across urban and peri-urban systems.",
    keywords: ["climate governance", "disaster risk", "policy integration", "resilience"],
    articleType: "Review Article",
    issueId: ijsuIssue2024_1.id,
    status: "PUBLISHED",
    publishedAt: "2024-06-15T00:00:00.000Z",
    doi: "10.37591/IJSU.2024.101",
    articleNumber: "101",
  });

  await upsertIjsuArticle({
    trackingNumber: "IJSU-2024-000102",
    title: "Urban Heat Adaptation Through Nature-Based Infrastructure",
    abstractText:
      "This study evaluates nature-based interventions and heat-risk mapping to improve adaptation outcomes in rapidly expanding cities.",
    keywords: ["urban heat", "nature-based solutions", "adaptation", "infrastructure"],
    articleType: "Research Article",
    issueId: ijsuIssue2024_1.id,
    status: "PUBLISHED",
    publishedAt: "2024-06-15T00:00:00.000Z",
    doi: "10.37591/IJSU.2024.102",
    articleNumber: "102",
  });

  await upsertIjsuArticle({
    trackingNumber: "IJSU-2024-000201",
    title: "Green Finance Signals and SME Sustainability Performance",
    abstractText:
      "An empirical analysis of sustainability-linked financing and how governance quality mediates SME transition outcomes.",
    keywords: ["green finance", "SME", "ESG", "governance"],
    articleType: "Research Article",
    issueId: ijsuIssue2024_2.id,
    status: "PUBLISHED",
    publishedAt: "2024-12-10T00:00:00.000Z",
    doi: "10.37591/IJSU.2024.201",
    articleNumber: "201",
  });

  await upsertIjsuArticle({
    trackingNumber: "IJSU-2025-000301",
    title: "Community-Led Coastal Resilience and Livelihood Security",
    abstractText:
      "A mixed-methods assessment of community-led adaptation, ecosystem restoration, and livelihood diversification in vulnerable coastal zones.",
    keywords: ["coastal resilience", "community adaptation", "livelihoods", "ecosystems"],
    articleType: "Research Article",
    issueId: ijsuIssue2025_1.id,
    status: "IN_PRESS",
    articleNumber: "301",
  });

  await upsertIjsuArticle({
    trackingNumber: "IJSU-2025-000302",
    title: "Circular Procurement Models for Public Infrastructure",
    abstractText:
      "This paper proposes procurement pathways for circular construction materials and evaluates lifecycle outcomes for public infrastructure.",
    keywords: ["circular economy", "procurement", "infrastructure", "lifecycle"],
    articleType: "Short Communication",
    issueId: ijsuIssue2025_1.id,
    status: "IN_PRESS",
    articleNumber: "302",
  });

  const publishedIjsuArticles = await prisma.article.findMany({
    where: {
      journalId: ijsuJournal.id,
      status: "PUBLISHED",
      submission: {
        trackingNumber: { in: ["IJSU-2024-000101", "IJSU-2024-000102", "IJSU-2024-000201"] },
      },
    },
    select: { id: true, title: true, submission: { select: { trackingNumber: true } } },
  });

  for (const article of publishedIjsuArticles) {
    const trackingNumber = article.submission.trackingNumber ?? article.id;
    const storageKey = `ijsu/published/${trackingNumber.toLowerCase()}/version-of-record.pdf`;
    const existingFile = await prisma.storedFile.findFirst({
      where: { storageKey },
      select: { id: true },
    });

    const pdfFileId =
      existingFile?.id ??
      (
        await (async () => {
          const fileSet = await prisma.fileSet.create({
            data: {
              journalId: ijsuJournal.id,
              kind: "PUBLISHED",
              storagePrefix: `ijsu/published/${trackingNumber.toLowerCase()}`,
              checksumManifestJson: { seeded: true, trackingNumber },
            },
            select: { id: true },
          });
          return prisma.storedFile.create({
            data: {
              fileSetId: fileSet.id,
              role: "OTHER",
              originalName: `${trackingNumber}-version-of-record.pdf`,
              mimeType: "application/pdf",
              sizeBytes: 120000,
              sha256: `seeded-${trackingNumber.toLowerCase()}`,
              storageKey,
              uploadedByUserId: admin.id,
            },
            select: { id: true },
          });
        })()
      ).id;

    const existingAsset = await prisma.publishedAsset.findFirst({
      where: { articleId: article.id, versionLabel: "Version of Record" },
      select: { id: true },
    });
    if (!existingAsset) {
      await prisma.publishedAsset.create({
        data: {
          articleId: article.id,
          pdfFileId,
          versionLabel: "Version of Record",
          publishedAt: new Date("2024-12-10T00:00:00.000Z"),
        },
      });
    }
  }

  // ─── IJMI: International Journal of Minerals ────────────────────────────

  const ijmiJournal =
    (await prisma.journal.findFirst({ where: { publisherId: publisher.id, slug: "ijmi" } })) ??
    (await prisma.journal.create({
      data: {
        publisherId: publisher.id,
        slug: "ijmi",
        title: "International Journal of Minerals",
        description:
          "Peer-reviewed journal launched in 2024 focused on mineral science, extractive metallurgy, ore beneficiation, sustainable resource development, and related interdisciplinary research.",
        status: JournalStatus.LIVE,
        timezone: "Asia/Kolkata",
        issnPrint: "3139-0706",
        submissionEmailFrom: "ijmi@stmjournals.com",
        brandingJson: {
          sourceUrl: "https://journals.stmjournals.com/ijmi/",
          abbreviation: "IJMI",
          publicationFormat: "Hybrid Open Access",
          language: "English",
          copyrightPolicy: "CC BY-NC-ND",
          publisherDisplay: "STM Journals, An imprint of Consortium e-Learning Network Pvt. Ltd.",
          doiPrefix: "10.37591/IJMI",
          issuesPerYear: 2,
          subject: "Mineral Science & Extractive Metallurgy",
          startingYear: 2024,
          sourceCapturedAt: "2026-05-13",
          editorialBoard: [
            { name: "Prof. A.R. Chaudhri", role: "Editor-in-Chief", affiliation: "Kurukshetra University", country: "India", expertise: "Mineral Science" },
            { name: "Prof. R.V.S.S.N. Ravikumar", role: "Associate Editor", affiliation: "Acharya Nagarjuna University", country: "India", expertise: "Spectroscopy, Material Characterization" },
            { name: "Dr. Amuda Kayode", role: "Associate Editor", affiliation: "Bayero University", country: "Nigeria", expertise: "Environmental Geochemistry" },
            { name: "Prof. Prachand Man Pradhan", role: "Associate Editor", affiliation: "Kathmandu University", country: "Nepal", expertise: "Mineral Processing" },
            { name: "Prof. Perveiz Khalid", role: "Associate Editor", affiliation: "University of the Punjab", country: "Pakistan", expertise: "Geology, Mineralogy" },
            { name: "Mr. Mahadev M", role: "Associate Editor", affiliation: "RNS Institute of Technology", country: "India", expertise: "Civil Engineering, Building Materials" },
          ],
        },
        requiredPolicyKeys: ["peer-review", "ethics", "plagiarism", "focus-scope"],
      },
    }));

  await prisma.journalRoleAssignment.upsert({
    where: { journalId_userId_role: { journalId: ijmiJournal.id, userId: admin.id, role: JournalRole.JOURNAL_ADMIN } },
    update: {},
    create: { journalId: ijmiJournal.id, userId: admin.id, role: JournalRole.JOURNAL_ADMIN },
  });

  // ─── IJMI Editorial Board Members ───────────────────────────────────────

  const ijmiBoardMembers = [
    { name: "Prof. A.R. Chaudhri", email: "ar.chaudhri@ijmi.stmjournals.local", role: JournalRole.EDITOR_IN_CHIEF, title: "Chairperson", affiliation: "Kurukshetra University, Haryana, India" },
    { name: "Prof. R.V.S.S.N. Ravikumar", email: "rvssn.ravikumar@ijmi.stmjournals.local", role: JournalRole.ASSOCIATE_EDITOR, title: "Professor", affiliation: "Acharya Nagarjuna University, Andhra Pradesh, India" },
    { name: "Dr. Amuda Kayode", email: "amuda.kayode@ijmi.stmjournals.local", role: JournalRole.ASSOCIATE_EDITOR, title: "Lecturer", affiliation: "Bayero University, Kano, Nigeria" },
    { name: "Prof. Prachand Man Pradhan", email: "prachand.pradhan@ijmi.stmjournals.local", role: JournalRole.ASSOCIATE_EDITOR, title: "Professor", affiliation: "Kathmandu University, Kathmandu, Nepal" },
    { name: "Prof. Perveiz Khalid", email: "perveiz.khalid@ijmi.stmjournals.local", role: JournalRole.ASSOCIATE_EDITOR, title: "Professor", affiliation: "University of the Punjab, Lahore, Pakistan" },
    { name: "Mr. Mahadev M", email: "mahadev.m@ijmi.stmjournals.local", role: JournalRole.ASSOCIATE_EDITOR, title: "Assistant Professor", affiliation: "RNS Institute of Technology, Bengaluru, Karnataka, India" },
  ];

  const ijmiBoardPasswordHash = await argon2.hash("password123");

  for (const member of ijmiBoardMembers) {
    const boardUser = await prisma.user.upsert({
      where: { email: member.email },
      update: { passwordHash: ijmiBoardPasswordHash, name: member.name },
      create: { email: member.email, name: member.name, passwordHash: ijmiBoardPasswordHash },
    });
    await prisma.journalRoleAssignment.upsert({
      where: { journalId_userId_role: { journalId: ijmiJournal.id, userId: boardUser.id, role: member.role } },
      update: {},
      create: { journalId: ijmiJournal.id, userId: boardUser.id, role: member.role },
    });
  }

  // ─── IJMI Policies ────────────────────────────────────────────────────

  await upsertJournalPolicy(
    ijmiJournal.id,
    "focus-scope",
    "Focus and Scope",
    `<h2>About the Journal</h2>
<p>The International Journal of Minerals (IJMI) is a peer-reviewed online journal (launched in 2024) that publishes original research, reviews, and short communications on mineral science, extractive metallurgy, and sustainable resource development.</p>
<h2>Focus Areas</h2>
<ul>
  <li><strong>Mineral processing and beneficiation:</strong> ore upgradation, flotation, leaching, gravity separation, magnetic separation, and nanobubble-assisted technologies.</li>
  <li><strong>Extractive metallurgy:</strong> hydrometallurgy, pyrometallurgy, electrometallurgy, and advanced smelting techniques.</li>
  <li><strong>Mineralogy and petrology:</strong> mineral characterization, petrographic analysis, geochemical assessment, and sediment provenance studies.</li>
  <li><strong>Environmental impact of mining:</strong> debris flow risk, heavy metal contamination, mine waste management, and environmental remediation.</li>
  <li><strong>Sustainable resource development:</strong> carbon sequestration in ultramafic rocks, strategic mineral extraction (lithium, beryllium, scandium), and circular economy in minerals.</li>
  <li><strong>Advanced materials:</strong> electrically conductive polymers, corrosion-resistant alloys, nanostructured materials, and lightweight aggregate concrete.</li>
  <li><strong>Data-driven and AI approaches:</strong> AI-assisted mineral identification, data-driven resource management, and sensor-based ore sorting.</li>
</ul>
<p><em>Source:</em> https://journals.stmjournals.com/focus-and-scope/ijmi</p>`,
    "Imported from IJMI public focus and scope page."
  );

  await upsertJournalPolicy(
    ijmiJournal.id,
    "peer-review",
    "Peer-Review Policy",
    `<h2>Peer-Review Policy</h2>
<p>IJMI uses a double-blind peer-review model to evaluate quality, validity, and originality before publication.</p>
<h3>Workflow</h3>
<ol>
  <li>Submission and editorial suitability check by IJMI editor.</li>
  <li>Preliminary screening for scope, formatting, and ethics compliance.</li>
  <li>Assignment to at least two independent reviewers based on subject expertise, reputation, and prior review experience.</li>
  <li>Reviewers assess originality, quality, methodology, significance, and presentation, providing recommendations (accept, minor revision, major revision, reject).</li>
  <li>Editorial decision and communication to authors with reviewer comments and revision instructions.</li>
  <li>Revision, resubmission, and final publication checks; major revisions may be re-reviewed.</li>
</ol>
<h3>Double-Blind Approach</h3>
<p>IJMI follows a double-blind approach where both reviewer and author identities are concealed throughout the review process to ensure impartial evaluation.</p>
<p><em>Source:</em> https://journals.stmjournals.com/prp/ijmi</p>`,
    "Imported from IJMI peer-review policy page."
  );

  await upsertJournalPolicy(
    ijmiJournal.id,
    "plagiarism",
    "Plagiarism Policy",
    `<h2>Plagiarism Policy</h2>
<p>IJMI enforces publication integrity checks and uses similarity screening tools. Similarity reports are reviewed under editorial policy with thresholds and case-based investigation.</p>
<ul>
  <li>Similarity analysis includes overall and single-source checks.</li>
  <li>Potential misconduct is investigated with editorial action pathways.</li>
  <li>Outcomes may include revision requests, rejection, correction, or retraction depending on severity.</li>
</ul>
<p><em>Source:</em> https://journals.stmjournals.com/plagiarism-policy/ijmi</p>`,
    "Imported from IJMI plagiarism policy page."
  );

  await upsertJournalPolicy(
    ijmiJournal.id,
    "ethics",
    "Publication Ethics and Virtue",
    `<h2>Publication Ethics and Virtue</h2>
<p>IJMI states alignment with COPE and ICMJE-style expectations for research integrity and transparent publication conduct.</p>
<ul>
  <li>Author obligations: originality, authorship integrity, disclosures, and data integrity.</li>
  <li>Reviewer/editor obligations: confidentiality, fairness, conflict management, and timely communication.</li>
  <li>Misconduct handling: complaints review, corrections/retractions/statements of concern as needed.</li>
  <li>Digital preservation commitments and long-term access guarantees.</li>
</ul>
<p><em>Source:</em> https://journals.stmjournals.com/pev/ijmi</p>`,
    "Imported from IJMI publication ethics page."
  );

  // ─── IJMI Volumes and Issues ────────────────────────────────────────────

  const ijmiVolume2024 = await prisma.volume.upsert({
    where: { journalId_year_number: { journalId: ijmiJournal.id, year: 2024, number: 1 } },
    update: {},
    create: { journalId: ijmiJournal.id, year: 2024, number: 1 },
  });
  const ijmiVolume2025 = await prisma.volume.upsert({
    where: { journalId_year_number: { journalId: ijmiJournal.id, year: 2025, number: 2 } },
    update: {},
    create: { journalId: ijmiJournal.id, year: 2025, number: 2 },
  });
  const ijmiVolume2026 = await prisma.volume.upsert({
    where: { journalId_year_number: { journalId: ijmiJournal.id, year: 2026, number: 3 } },
    update: {},
    create: { journalId: ijmiJournal.id, year: 2026, number: 3 },
  });

  const ijmiIssue2024_1 = await prisma.issue.upsert({
    where: { journalId_volumeId_number: { journalId: ijmiJournal.id, volumeId: ijmiVolume2024.id, number: 1 } },
    update: {
      title: "Mineral Processing, Environmental Impact, and Geochemical Assessment",
      publicationDate: new Date("2024-06-15T00:00:00.000Z"),
      status: "PUBLISHED",
    },
    create: {
      journalId: ijmiJournal.id,
      volumeId: ijmiVolume2024.id,
      number: 1,
      title: "Mineral Processing, Environmental Impact, and Geochemical Assessment",
      publicationDate: new Date("2024-06-15T00:00:00.000Z"),
      status: "PUBLISHED",
    },
  });

  const ijmiIssue2024_2 = await prisma.issue.upsert({
    where: { journalId_volumeId_number: { journalId: ijmiJournal.id, volumeId: ijmiVolume2024.id, number: 2 } },
    update: {
      title: "Mining Risk, Lithium Extraction, and Advanced Mineral Nanostructures",
      publicationDate: new Date("2024-12-10T00:00:00.000Z"),
      status: "PUBLISHED",
    },
    create: {
      journalId: ijmiJournal.id,
      volumeId: ijmiVolume2024.id,
      number: 2,
      title: "Mining Risk, Lithium Extraction, and Advanced Mineral Nanostructures",
      publicationDate: new Date("2024-12-10T00:00:00.000Z"),
      status: "PUBLISHED",
    },
  });

  const ijmiIssue2025_1 = await prisma.issue.upsert({
    where: { journalId_volumeId_number: { journalId: ijmiJournal.id, volumeId: ijmiVolume2025.id, number: 1 } },
    update: {
      title: "Cement Blends, Carbon Sequestration, and AI in Mineral Resource Management",
      publicationDate: new Date("2025-06-20T00:00:00.000Z"),
      status: "PUBLISHED",
    },
    create: {
      journalId: ijmiJournal.id,
      volumeId: ijmiVolume2025.id,
      number: 1,
      title: "Cement Blends, Carbon Sequestration, and AI in Mineral Resource Management",
      publicationDate: new Date("2025-06-20T00:00:00.000Z"),
      status: "PUBLISHED",
    },
  });

  const ijmiIssue2025_2 = await prisma.issue.upsert({
    where: { journalId_volumeId_number: { journalId: ijmiJournal.id, volumeId: ijmiVolume2025.id, number: 2 } },
    update: {
      title: "Environmental Mining Impact, Petrology Innovation, and Metals in Pharmacy",
      publicationDate: new Date("2025-12-10T00:00:00.000Z"),
      status: "PUBLISHED",
    },
    create: {
      journalId: ijmiJournal.id,
      volumeId: ijmiVolume2025.id,
      number: 2,
      title: "Environmental Mining Impact, Petrology Innovation, and Metals in Pharmacy",
      publicationDate: new Date("2025-12-10T00:00:00.000Z"),
      status: "PUBLISHED",
    },
  });

  const ijmiIssue2026_1 = await prisma.issue.upsert({
    where: { journalId_volumeId_number: { journalId: ijmiJournal.id, volumeId: ijmiVolume2026.id, number: 1 } },
    update: {
      title: "Niobium Complexes, Deccan Basalts, and Nanobubble Flotation Technology",
      publicationDate: new Date("2026-06-15T00:00:00.000Z"),
      status: "PLANNED",
    },
    create: {
      journalId: ijmiJournal.id,
      volumeId: ijmiVolume2026.id,
      number: 1,
      title: "Niobium Complexes, Deccan Basalts, and Nanobubble Flotation Technology",
      publicationDate: new Date("2026-06-15T00:00:00.000Z"),
      status: "PLANNED",
    },
  });

  // ─── IJMI Articles ──────────────────────────────────────────────────────

  async function upsertIjmiArticle(input: {
    trackingNumber: string;
    title: string;
    abstractText: string;
    keywords: string[];
    articleType: string;
    issueId?: string;
    status: "IN_PRESS" | "PUBLISHED";
    publishedAt?: string;
    doi?: string;
    articleNumber?: string;
  }) {
    const submission = await prisma.submission.upsert({
      where: { journalId_trackingNumber: { journalId: ijmiJournal.id, trackingNumber: input.trackingNumber } },
      update: {
        status: SubmissionStatus.ACCEPTED,
        manuscriptTitle: input.title,
        abstractText: input.abstractText,
        keywordsText: input.keywords,
        articleType: input.articleType,
        submittedAt: new Date("2025-01-15T00:00:00.000Z"),
      },
      create: {
        journalId: ijmiJournal.id,
        submitterUserId: author.id,
        trackingNumber: input.trackingNumber,
        status: SubmissionStatus.ACCEPTED,
        manuscriptTitle: input.title,
        abstractText: input.abstractText,
        keywordsText: input.keywords,
        articleType: input.articleType,
        submittedAt: new Date("2025-01-15T00:00:00.000Z"),
      },
    });

    await prisma.article.upsert({
      where: { submissionId: submission.id },
      update: {
        title: input.title,
        abstractText: input.abstractText,
        keywordsText: input.keywords,
        issueId: input.issueId,
        status: input.status,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
        doi: input.doi ?? null,
        articleNumber: input.articleNumber ?? null,
        access: "OPEN",
      },
      create: {
        submissionId: submission.id,
        journalId: ijmiJournal.id,
        issueId: input.issueId,
        title: input.title,
        abstractText: input.abstractText,
        keywordsText: input.keywords,
        status: input.status,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
        doi: input.doi ?? null,
        articleNumber: input.articleNumber ?? null,
        access: "OPEN",
      },
    });
  }

  // Volume 01, Issue 01 (2024)
  await upsertIjmiArticle({
    trackingNumber: "IJMI-2024-000101",
    title: "Environmental Impact of Ghaf Tree (Prosopis cineraria) on Heavy Metals Concentration in Atmosphere",
    abstractText:
      "The Ghaf is a hardy tree, drought-resistant, and can grow up to ten meters in height. This study examines the impact of the Ghaf tree on heavy metal concentrations in the atmosphere, evaluating its role as a bioindicator and phytoremediator in arid environments.",
    keywords: ["heavy metals", "Prosopis cineraria", "atmosphere", "phytoremediation", "arid environment"],
    articleType: "Research Article",
    issueId: ijmiIssue2024_1.id,
    status: "PUBLISHED",
    publishedAt: "2024-06-15T00:00:00.000Z",
    doi: "10.37591/IJMI.2024.101",
    articleNumber: "101",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2024-000102",
    title: "Selected Heavy Metals Levels (Cu, Cr, Cd, Pb, Fe) in Gwadabawa Lake, Sokoto State, Nigeria",
    abstractText:
      "The main aim of this work was to determine the concentrations of some heavy metals, specifically Cu, Cd, Pb, Cr and Fe in Gwadabawa lake, Gwadabawa, Sokoto State, Nigeria, assessing ecological and human health risks associated with metal contamination in freshwater systems.",
    keywords: ["heavy metals", "Gwadabawa Lake", "water contamination", "ecological risk", "Nigeria"],
    articleType: "Research Article",
    issueId: ijmiIssue2024_1.id,
    status: "PUBLISHED",
    publishedAt: "2024-06-15T00:00:00.000Z",
    doi: "10.37591/IJMI.2024.102",
    articleNumber: "102",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2024-000103",
    title: "Advance Mineral Practices Techniques",
    abstractText:
      "In recent years, the field of mineral processing has witnessed significant advancements aimed at improving the efficiency, sustainability, and environmental compatibility of extraction and beneficiation operations. This review surveys emerging technologies and best practices.",
    keywords: ["mineral processing", "beneficiation", "sustainability", "extraction", "advanced techniques"],
    articleType: "Review Article",
    issueId: ijmiIssue2024_1.id,
    status: "PUBLISHED",
    publishedAt: "2024-06-15T00:00:00.000Z",
    doi: "10.37591/IJMI.2024.103",
    articleNumber: "103",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2024-000104",
    title: "Optimal Dosage of Pumice in Lightweight Aggregate based Concrete",
    abstractText:
      "Lightweight concrete (LWC) is a pioneering solution in the construction sector, characterized by its unique composition and versatile applications. This study investigates the optimal dosage of pumice as a lightweight aggregate to balance strength and density in structural concrete.",
    keywords: ["lightweight concrete", "pumice", "aggregate", "compressive strength", "construction materials"],
    articleType: "Research Article",
    issueId: ijmiIssue2024_1.id,
    status: "PUBLISHED",
    publishedAt: "2024-06-15T00:00:00.000Z",
    doi: "10.37591/IJMI.2024.104",
    articleNumber: "104",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2024-000105",
    title: "Geochemometric Assessment of Primordial Radionuclides and Trace Elements in Coastal Sediments: Environmental and Radiological Implications for South India",
    abstractText:
      "This study focuses on environmental radioactivity and trace element contamination in coastal sediments along the southern region of the Indian subcontinent, employing geochemometric methods to assess radiological risk and ecological impact.",
    keywords: ["radionuclides", "trace elements", "coastal sediments", "geochemometric", "radiological risk"],
    articleType: "Research Article",
    issueId: ijmiIssue2024_1.id,
    status: "PUBLISHED",
    publishedAt: "2024-06-15T00:00:00.000Z",
    doi: "10.37591/IJMI.2024.105",
    articleNumber: "105",
  });

  // Volume 01, Issue 02 (2024)
  await upsertIjmiArticle({
    trackingNumber: "IJMI-2024-000201",
    title: "Debris Flows in Mining Areas: Risk Assessment and Mitigation Strategies for Mine Waste Management",
    abstractText:
      "This study investigates the dynamics and risks associated with debris flows, focusing on the differentiation between natural and mine-generated debris flows, and proposes integrated mitigation strategies for mine waste management in vulnerable terrain.",
    keywords: ["debris flows", "mine waste", "risk assessment", "mitigation", "environmental hazard"],
    articleType: "Research Article",
    issueId: ijmiIssue2024_2.id,
    status: "PUBLISHED",
    publishedAt: "2024-12-10T00:00:00.000Z",
    doi: "10.37591/IJMI.2024.201",
    articleNumber: "201",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2024-000202",
    title: "Strategic Approaches to Sustainable Lithium Extraction: Advances in Technology, Resource Recovery, and Environmental Management",
    abstractText:
      "Lithium, a critical mineral for modern technological advancements, is in high demand due to its role in the production of lithium-ion batteries. This review surveys advances in sustainable lithium extraction technologies, resource recovery methods, and environmental management frameworks.",
    keywords: ["lithium extraction", "sustainable mining", "resource recovery", "environmental management", "battery minerals"],
    articleType: "Review Article",
    issueId: ijmiIssue2024_2.id,
    status: "PUBLISHED",
    publishedAt: "2024-12-10T00:00:00.000Z",
    doi: "10.37591/IJMI.2024.202",
    articleNumber: "202",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2024-000203",
    title: "Beryllium Mineralogy and Its Strategic Applications in Modern Industries",
    abstractText:
      "Beryllium, a rare lithophile element, exhibits unique physical and chemical properties that make it indispensable in various high-technology applications. This review covers beryllium mineralogy, extraction challenges, and its strategic role in aerospace, nuclear, and electronics industries.",
    keywords: ["beryllium", "mineralogy", "strategic minerals", "aerospace", "extraction"],
    articleType: "Review Article",
    issueId: ijmiIssue2024_2.id,
    status: "PUBLISHED",
    publishedAt: "2024-12-10T00:00:00.000Z",
    doi: "10.37591/IJMI.2024.203",
    articleNumber: "203",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2024-000204",
    title: "Enhancing Functional and Structural Properties of Advanced Materials through Scandium-based Nanostructures: Applications in Ceramics, Thermoelectrics, Memory Devices, and High-Strength Alloys",
    abstractText:
      "This study explores the fabrication and properties of scandium-based nanostructured materials with applications in ceramics, glass, thermoelectric devices, memory storage, and high-strength alloy systems, highlighting the role of scandium in advancing material performance.",
    keywords: ["scandium", "nanostructures", "ceramics", "thermoelectrics", "high-strength alloys"],
    articleType: "Research Article",
    issueId: ijmiIssue2024_2.id,
    status: "PUBLISHED",
    publishedAt: "2024-12-10T00:00:00.000Z",
    doi: "10.37591/IJMI.2024.204",
    articleNumber: "204",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2024-000205",
    title: "Elemental Mobility and Provenance in Sediments: A Geochemical Study of Deccan Basalts, Bay of Bengal, and Northern China",
    abstractText:
      "Twenty-eight sediment samples from seventeen rivers, including the Krishna headwaters and the west-flowing Western Ghat rivers, draining the Deccan basalts, Bay of Bengal, and Northern China were analysed to determine elemental mobility and sediment provenance using geochemical fingerprinting.",
    keywords: ["sediment provenance", "Deccan basalts", "geochemistry", "elemental mobility", "Bay of Bengal"],
    articleType: "Research Article",
    issueId: ijmiIssue2024_2.id,
    status: "PUBLISHED",
    publishedAt: "2024-12-10T00:00:00.000Z",
    doi: "10.37591/IJMI.2024.205",
    articleNumber: "205",
  });

  // Volume 02, Issue 01 (2025)
  await upsertIjmiArticle({
    trackingNumber: "IJMI-2025-000301",
    title: "Strength Prediction and Optimization of Portland Limestone Cement Blended with Metakaolin and Rice Husk Ash",
    abstractText:
      "This study explores the effects of Rice Husk Ash (RHA) and Metakaolin (MK) on the compressive strength of Portland Limestone Cement (PLC) mortar, proposing optimization models for predicting strength development in blended cement systems.",
    keywords: ["Portland limestone cement", "metakaolin", "rice husk ash", "compressive strength", "blended cement"],
    articleType: "Research Article",
    issueId: ijmiIssue2025_1.id,
    status: "PUBLISHED",
    publishedAt: "2025-06-20T00:00:00.000Z",
    doi: "10.37591/IJMI.2025.301",
    articleNumber: "301",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2025-000302",
    title: "Degradation of Building Materials by Corrosive Pollutants",
    abstractText:
      "Fiber reinforced polymers (FRP) is used for the corrosion suppression of reinforced concrete structures (RCS). This study examines the degradation mechanisms of building materials exposed to corrosive pollutants and evaluates FRP-based protective strategies.",
    keywords: ["building materials", "corrosion", "FRP", "reinforced concrete", "degradation"],
    articleType: "Research Article",
    issueId: ijmiIssue2025_1.id,
    status: "PUBLISHED",
    publishedAt: "2025-06-20T00:00:00.000Z",
    doi: "10.37591/IJMI.2025.302",
    articleNumber: "302",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2025-000303",
    title: "Data-driven Approaches to Mineral Resource Management Using AI: A Brief Review",
    abstractText:
      "The role of Artificial Intelligence (AI) in the mineral resource sector has become increasingly significant over the past few years, as industries seek to optimize exploration, extraction, and resource allocation. This brief review surveys data-driven and AI-assisted approaches to mineral resource management.",
    keywords: ["artificial intelligence", "mineral resources", "data-driven", "resource management", "exploration"],
    articleType: "Review Article",
    issueId: ijmiIssue2025_1.id,
    status: "PUBLISHED",
    publishedAt: "2025-06-20T00:00:00.000Z",
    doi: "10.37591/IJMI.2025.303",
    articleNumber: "303",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2025-000304",
    title: "Carbon Sequestration in Mineralogy: Potential of Ultramafic Rocks for CO₂ Storage",
    abstractText:
      "The increasing concentration of atmospheric carbon dioxide (CO₂) due to anthropogenic activities has necessitated the development of effective carbon sequestration strategies. This study evaluates the mineral carbonation potential of ultramafic rocks for long-term CO₂ storage.",
    keywords: ["carbon sequestration", "ultramafic rocks", "mineral carbonation", "CO₂ storage", "climate mitigation"],
    articleType: "Research Article",
    issueId: ijmiIssue2025_1.id,
    status: "PUBLISHED",
    publishedAt: "2025-06-20T00:00:00.000Z",
    doi: "10.37591/IJMI.2025.304",
    articleNumber: "304",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2025-000305",
    title: "Advancements in Ore Beneficiation Technologies: A Review of Modern Extraction Methods",
    abstractText:
      "Ore beneficiation plays an essential role in the mining industry, as it facilitates the extraction of valuable minerals from their ores while ensuring environmental compliance and economic viability. This review covers modern extraction methods and emerging beneficiation technologies.",
    keywords: ["ore beneficiation", "extraction methods", "mining", "flotation", "hydrometallurgy"],
    articleType: "Review Article",
    issueId: ijmiIssue2025_1.id,
    status: "PUBLISHED",
    publishedAt: "2025-06-20T00:00:00.000Z",
    doi: "10.37591/IJMI.2025.305",
    articleNumber: "305",
  });

  // Volume 02, Issue 02 (2025)
  await upsertIjmiArticle({
    trackingNumber: "IJMI-2025-000401",
    title: "Evaluating the Environmental Impact of Mining: Procedures, Outcomes, and Sustainable Remediation",
    abstractText:
      "Mining is necessary for economic growth and getting resources, yet also has a big impact on the environment. This article looks at the different ways mining affects the environment, the outcomes observed, and sustainable remediation strategies for impacted ecosystems.",
    keywords: ["environmental impact", "mining", "remediation", "sustainability", "ecosystem"],
    articleType: "Review Article",
    issueId: ijmiIssue2025_2.id,
    status: "PUBLISHED",
    publishedAt: "2025-12-10T00:00:00.000Z",
    doi: "10.37591/IJMI.2025.401",
    articleNumber: "401",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2025-000402",
    title: "Revolutionizing Petrology and Mineralogy: The Study of AI and Advanced Sensor Technologies",
    abstractText:
      "Petrology and mineralogy are fundamental to understanding Earth's intricate processes, from crustal evolution to economic resource formation. This study examines how AI and advanced sensor technologies are revolutionizing mineral identification, classification, and exploration.",
    keywords: ["petrology", "mineralogy", "artificial intelligence", "sensor technology", "mineral identification"],
    articleType: "Research Article",
    issueId: ijmiIssue2025_2.id,
    status: "PUBLISHED",
    publishedAt: "2025-12-10T00:00:00.000Z",
    doi: "10.37591/IJMI.2025.402",
    articleNumber: "402",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2025-000403",
    title: "Azepines, Chemistry, Synthesis and Reactions",
    abstractText:
      "Azepines, which consist of a seven-membered cyclic compound featuring six carbon atoms, an additional nitrogen atom, and no double bonds between ring atoms, represent an important class of heterocyclic compounds. This review covers their chemistry, synthesis pathways, and reaction mechanisms.",
    keywords: ["azepines", "heterocyclic compounds", "synthesis", "organic chemistry", "nitrogen heterocycles"],
    articleType: "Review Article",
    issueId: ijmiIssue2025_2.id,
    status: "PUBLISHED",
    publishedAt: "2025-12-10T00:00:00.000Z",
    doi: "10.37591/IJMI.2025.403",
    articleNumber: "403",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2025-000404",
    title: "Steel Structural and Functional Characteristics Focusing on Corrosion Mechanisms",
    abstractText:
      "This research article examines steel structural and functional characteristics, focusing on corrosion mechanisms and inhibitor protection strategies that enhance durability and performance of steel in aggressive environments.",
    keywords: ["steel", "corrosion", "inhibitor", "structural properties", "durability"],
    articleType: "Research Article",
    issueId: ijmiIssue2025_2.id,
    status: "PUBLISHED",
    publishedAt: "2025-12-10T00:00:00.000Z",
    doi: "10.37591/IJMI.2025.404",
    articleNumber: "404",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2025-000405",
    title: "Metals and Minerals in Pharmacy: Current Trends, Biomedical Applications, and Future Innovations",
    abstractText:
      "Metals and minerals have played important roles in medicine for centuries, ranging from the use of simple mineral powders in traditional therapies to sophisticated nanoparticle-based drug delivery systems. This review surveys current trends and future innovations in biomedical applications of metals and minerals.",
    keywords: ["metals in pharmacy", "biomedical applications", "mineral-based therapeutics", "nanoparticles", "drug delivery"],
    articleType: "Review Article",
    issueId: ijmiIssue2025_2.id,
    status: "PUBLISHED",
    publishedAt: "2025-12-10T00:00:00.000Z",
    doi: "10.37591/IJMI.2025.405",
    articleNumber: "405",
  });

  // Volume 03, Issue 01 (2026) — IN_PRESS / PLANNED issue
  await upsertIjmiArticle({
    trackingNumber: "IJMI-2026-000501",
    title: "Reactivity of Monochlorotetrakis2-Isopropylphenoxoniobium(V), [NbCl(OC₆H₄CH(CH₃)₂-2)₄] towards Chelating Ligands",
    abstractText:
      "The niobium(V) complexes with the formula [NbCl(OC₆H₄CH(CH₃)₂-2)₄] were successfully synthesized in high yields through the reaction of niobium pentachloride with 2-isopropylphenol. This study investigates their reactivity towards various chelating ligands.",
    keywords: ["niobium complexes", "chelating ligands", "coordination chemistry", "isopropylphenol", "synthesis"],
    articleType: "Research Article",
    issueId: ijmiIssue2026_1.id,
    status: "IN_PRESS",
    articleNumber: "501",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2026-000502",
    title: "Petrographic and Geochemical Characteristics of Deccan Trap Basalts from Belagavi, Karnataka, India",
    abstractText:
      "The Deccan Trap volcanic province represents one of the largest continental flood basalt provinces in the world and provides significant insights into mantle dynamics and crustal evolution. This study presents petrographic and geochemical analyses of Deccan Trap basalts from the Belagavi region.",
    keywords: ["Deccan Trap", "basalts", "petrography", "geochemistry", "Belagavi"],
    articleType: "Research Article",
    issueId: ijmiIssue2026_1.id,
    status: "IN_PRESS",
    articleNumber: "502",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2026-000503",
    title: "Iron Ore Beneficiation through Reverse Flotation: Advances in Nanobubble-Assisted Flotation Technology for Lean Grade Ore Upgradation and Silica Removal: A Review",
    abstractText:
      "The global demand for high-grade iron ore concentrates continues to surge as readily available rich ores become depleted. This review examines advances in nanobubble-assisted reverse flotation technology for lean grade ore upgradation and efficient silica removal.",
    keywords: ["iron ore", "reverse flotation", "nanobubble", "silica removal", "beneficiation"],
    articleType: "Review Article",
    issueId: ijmiIssue2026_1.id,
    status: "IN_PRESS",
    articleNumber: "503",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2026-000504",
    title: "Innovations in Mineral Science and Engineering for Sustainable Resource Development",
    abstractText:
      "The growing global demand for mineral resources, coupled with increasing environmental and social concerns, has intensified the need for sustainable approaches to mineral exploration, extraction, and processing. This review highlights recent innovations driving sustainability in mineral science and engineering.",
    keywords: ["sustainable development", "mineral science", "engineering innovation", "resource management", "green mining"],
    articleType: "Review Article",
    issueId: ijmiIssue2026_1.id,
    status: "IN_PRESS",
    articleNumber: "504",
  });

  await upsertIjmiArticle({
    trackingNumber: "IJMI-2026-000505",
    title: "Study of Electrically Conductive Polymer for Antistatic and Sensor Application",
    abstractText:
      "Electrically conductive polymers (ECPs) are a unique category of smart materials that integrate the mechanical flexibility and ease of processing of conventional polymers with the electrical conductivity of metals. This study evaluates ECPs for antistatic protection and sensor applications.",
    keywords: ["conductive polymers", "antistatic", "sensor", "smart materials", "ECP"],
    articleType: "Research Article",
    issueId: ijmiIssue2026_1.id,
    status: "IN_PRESS",
    articleNumber: "505",
  });

  // ─── IJMI Published Assets for PUBLISHED articles ──────────────────────

  const publishedIjmiArticles = await prisma.article.findMany({
    where: {
      journalId: ijmiJournal.id,
      status: "PUBLISHED",
    },
    select: { id: true, title: true, submission: { select: { trackingNumber: true } } },
  });

  for (const article of publishedIjmiArticles) {
    const trackingNumber = article.submission.trackingNumber ?? article.id;
    const storageKey = `ijmi/published/${trackingNumber.toLowerCase()}/version-of-record.pdf`;
    const existingFile = await prisma.storedFile.findFirst({
      where: { storageKey },
      select: { id: true },
    });

    const pdfFileId =
      existingFile?.id ??
      (
        await (async () => {
          const fileSet = await prisma.fileSet.create({
            data: {
              journalId: ijmiJournal.id,
              kind: "PUBLISHED",
              storagePrefix: `ijmi/published/${trackingNumber.toLowerCase()}`,
              checksumManifestJson: { seeded: true, trackingNumber },
            },
            select: { id: true },
          });
          return prisma.storedFile.create({
            data: {
              fileSetId: fileSet.id,
              role: "OTHER",
              originalName: `${trackingNumber}-version-of-record.pdf`,
              mimeType: "application/pdf",
              sizeBytes: 150000,
              sha256: `seeded-${trackingNumber.toLowerCase()}`,
              storageKey,
              uploadedByUserId: admin.id,
            },
            select: { id: true },
          });
        })()
      ).id;

    const existingAsset = await prisma.publishedAsset.findFirst({
      where: { articleId: article.id, versionLabel: "Version of Record" },
      select: { id: true },
    });
    if (!existingAsset) {
      await prisma.publishedAsset.create({
        data: {
          articleId: article.id,
          pdfFileId,
          versionLabel: "Version of Record",
          publishedAt: new Date("2025-12-10T00:00:00.000Z"),
        },
      });
    }
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
