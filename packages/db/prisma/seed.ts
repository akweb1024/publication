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
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
