import * as prismaClient from "@prisma/client";

/**
 * Centralized runtime accessor for Prisma enums.
 *
 * Prisma generates enums at runtime; TypeScript ESM mode
 * cannot import them as values directly. This single object
 * replaces the duplicated `const { X } = prismaClient as { ... }`
 * pattern found across 5+ files.
 */
export const prismaEnum = prismaClient as unknown as {
    JournalRole: typeof import("@prisma/client").JournalRole;
    SubmissionStatus: typeof import("@prisma/client").SubmissionStatus;
    ReviewAssignmentStatus: typeof import("@prisma/client").ReviewAssignmentStatus;
    ReviewRecommendation: typeof import("@prisma/client").ReviewRecommendation;
    DecisionType: typeof import("@prisma/client").DecisionType;
    EditorAssignmentRole: typeof import("@prisma/client").EditorAssignmentRole;
    ArticleStatus: typeof import("@prisma/client").ArticleStatus;
    IssueStatus: typeof import("@prisma/client").IssueStatus;
    ArticleAccess: typeof import("@prisma/client").ArticleAccess;
    StorageProvider: typeof import("@prisma/client").StorageProvider;
    StorageTarget: typeof import("@prisma/client").StorageTarget;
    DataSyncRunStatus: typeof import("@prisma/client").DataSyncRunStatus;
    MessageDeliveryStatus: typeof import("@prisma/client").MessageDeliveryStatus;
    NotificationEventStatus: typeof import("@prisma/client").NotificationEventStatus;
    FileSetKind: typeof import("@prisma/client").FileSetKind;
    StoredFileRole: typeof import("@prisma/client").StoredFileRole;
    JournalStatus: typeof import("@prisma/client").JournalStatus;
    UserStatus: typeof import("@prisma/client").UserStatus;
    PolicyContext: typeof import("@prisma/client").PolicyContext;
    ReviewModel: typeof import("@prisma/client").ReviewModel;
};
