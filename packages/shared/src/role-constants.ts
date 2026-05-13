import { prismaEnum } from "./prisma-enums.js";
import type { JournalRole as JournalRoleType } from "@prisma/client";

/** Roles that can perform editorial actions on submissions. */
export const EDITOR_ROLES: JournalRoleType[] = [
    prismaEnum.JournalRole.JOURNAL_ADMIN,
    prismaEnum.JournalRole.EDITOR_IN_CHIEF,
    prismaEnum.JournalRole.MANAGING_EDITOR,
    prismaEnum.JournalRole.SECTION_EDITOR,
    prismaEnum.JournalRole.ASSOCIATE_EDITOR,
];

/** Roles required to set up MFA. */
export const MFA_REQUIRED_ROLES: JournalRoleType[] = [
    ...EDITOR_ROLES,
    prismaEnum.JournalRole.COPYEDITOR,
    prismaEnum.JournalRole.PRODUCTION_EDITOR,
];

/** Roles considered editorial staff. */
export const EDITORIAL_ROLES: JournalRoleType[] = [...MFA_REQUIRED_ROLES];

/** Roles with journal-level management privileges. */
export const MANAGEMENT_ROLES: JournalRoleType[] = [
    prismaEnum.JournalRole.JOURNAL_ADMIN,
    prismaEnum.JournalRole.EDITOR_IN_CHIEF,
    prismaEnum.JournalRole.MANAGING_EDITOR,
];

/** Roles for journal settings/configuration. */
export const SETTINGS_ROLES: JournalRoleType[] = [...MANAGEMENT_ROLES];