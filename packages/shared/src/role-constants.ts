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

/* ──────────────────────────────────────────────────────────
 *  Role Hierarchy
 *
 *  Authority chain: JOURNAL_ADMIN → EDITOR_IN_CHIEF → MANAGING_EDITOR
 *                   → SECTION_EDITOR → ASSOCIATE_EDITOR
 *
 *  Parallel domain tracks:
 *    Production:  PRODUCTION_EDITOR → COPYEDITOR
 *    Review:      REVIEWER
 *    Support:     AUTHOR_SUPPORT
 *    Access:      SUBSCRIBER
 *
 *  Inheritance rules:
 *    1. Higher authority-chain roles inherit capabilities of
 *       lower authority-chain roles (strict vertical inheritance).
 *    2. Admin-tier roles (JOURNAL_ADMIN, EDITOR_IN_CHIEF,
 *       MANAGING_EDITOR) override ALL domain-specific checks.
 *    3. Authority-chain roles (SECTION_EDITOR, ASSOCIATE_EDITOR)
 *       inherit REVIEWER capabilities but NOT production-domain
 *       capabilities.
 * ────────────────────────────────────────────────────────── */

/** Numeric authority level — higher = more privilege. */
export const ROLE_HIERARCHY_LEVEL: Record<JournalRoleType, number> = {
    JOURNAL_ADMIN: 100,
    EDITOR_IN_CHIEF: 90,
    MANAGING_EDITOR: 80,
    SECTION_EDITOR: 70,
    ASSOCIATE_EDITOR: 60,
    PRODUCTION_EDITOR: 50,
    COPYEDITOR: 40,
    REVIEWER: 30,
    AUTHOR_SUPPORT: 20,
    SUBSCRIBER: 10,
};

/** Tier grouping for UI and capability derivation. */
export type RoleTier = "admin" | "editorial" | "production" | "review" | "support" | "subscriber";

export const ROLE_TIER: Record<JournalRoleType, RoleTier> = {
    JOURNAL_ADMIN: "admin",
    EDITOR_IN_CHIEF: "admin",
    MANAGING_EDITOR: "admin",
    SECTION_EDITOR: "editorial",
    ASSOCIATE_EDITOR: "editorial",
    PRODUCTION_EDITOR: "production",
    COPYEDITOR: "production",
    REVIEWER: "review",
    AUTHOR_SUPPORT: "support",
    SUBSCRIBER: "subscriber",
};

/** Authority-chain roles that override all domain checks. */
export const AUTHORITY_OVERRIDE_ROLES: JournalRoleType[] = [
    prismaEnum.JournalRole.JOURNAL_ADMIN,
    prismaEnum.JournalRole.EDITOR_IN_CHIEF,
    prismaEnum.JournalRole.MANAGING_EDITOR,
];

/** Roles in the vertical authority chain (strict inheritance). */
export const AUTHORITY_CHAIN: JournalRoleType[] = [
    prismaEnum.JournalRole.JOURNAL_ADMIN,
    prismaEnum.JournalRole.EDITOR_IN_CHIEF,
    prismaEnum.JournalRole.MANAGING_EDITOR,
    prismaEnum.JournalRole.SECTION_EDITOR,
    prismaEnum.JournalRole.ASSOCIATE_EDITOR,
];

/** Roles in the production domain track. */
export const PRODUCTION_TRACK: JournalRoleType[] = [
    prismaEnum.JournalRole.PRODUCTION_EDITOR,
    prismaEnum.JournalRole.COPYEDITOR,
];

/** Human-readable labels for UI display. */
export const ROLE_LABELS: Record<JournalRoleType, string> = {
    JOURNAL_ADMIN: "Journal Admin",
    EDITOR_IN_CHIEF: "Editor-in-Chief",
    MANAGING_EDITOR: "Managing Editor",
    SECTION_EDITOR: "Section Editor",
    ASSOCIATE_EDITOR: "Associate Editor",
    PRODUCTION_EDITOR: "Production Editor",
    COPYEDITOR: "Copyeditor",
    REVIEWER: "Reviewer",
    AUTHOR_SUPPORT: "Author Support",
    SUBSCRIBER: "Subscriber",
};

/** Tier display labels for UI section headers. */
export const TIER_LABELS: Record<RoleTier, string> = {
    admin: "Administration",
    editorial: "Editorial",
    production: "Production & Publishing",
    review: "Peer Review",
    support: "Author Support",
    subscriber: "Subscriber Access",
};

/**
 * Determine whether `heldRole` satisfies a check that requires `requiredRole`.
 *
 * Returns true when:
 *  1. heldRole === requiredRole (exact match)
 *  2. heldRole is in the authority chain AND has a higher level than
 *     requiredRole AND requiredRole is also in the authority chain
 *     (vertical inheritance: EiC satisfies SECTION_EDITOR checks)
 *  3. heldRole is an authority-override role (admin tier) AND
 *     requiredRole is in ANY domain track (cross-domain override:
 *     MANAGING_EDITOR satisfies PRODUCTION_EDITOR checks)
 *  4. heldRole is in the authority chain (SECTION_EDITOR, ASSOCIATE_EDITOR)
 *     AND requiredRole is REVIEWER (editorial roles inherit review capability)
 *  5. heldRole is PRODUCTION_EDITOR AND requiredRole is COPYEDITOR
 *     (production track vertical inheritance)
 */
export function roleSatisfies(heldRole: JournalRoleType, requiredRole: JournalRoleType): boolean {
    // 1. Exact match
    if (heldRole === requiredRole) return true;

    const heldLevel = ROLE_HIERARCHY_LEVEL[heldRole];
    const requiredLevel = ROLE_HIERARCHY_LEVEL[requiredRole];

    // 2. Vertical authority-chain inheritance
    //    Higher authority roles (admin, editorial tiers) inherit lower
    //    authority roles when both are in the authority chain.
    const heldIsAuthority = AUTHORITY_CHAIN.includes(heldRole);
    const requiredIsAuthority = AUTHORITY_CHAIN.includes(requiredRole);
    if (heldIsAuthority && requiredIsAuthority && heldLevel > requiredLevel) {
        return true;
    }

    // 3. Authority override — admin tier overrides ALL domain checks
    //    JOURNAL_ADMIN, EDITOR_IN_CHIEF, MANAGING_EDITOR satisfy any role.
    if (AUTHORITY_OVERRIDE_ROLES.includes(heldRole)) {
        return true;
    }

    // 4. Editorial-tier roles (SECTION_EDITOR, ASSOCIATE_EDITOR) inherit
    //    REVIEWER capability — editors can always perform review actions.
    if (
        (heldRole === prismaEnum.JournalRole.SECTION_EDITOR ||
            heldRole === prismaEnum.JournalRole.ASSOCIATE_EDITOR) &&
        requiredRole === prismaEnum.JournalRole.REVIEWER
    ) {
        return true;
    }

    // 5. Production track vertical inheritance
    //    PRODUCTION_EDITOR satisfies COPYEDITOR checks.
    if (
        heldRole === prismaEnum.JournalRole.PRODUCTION_EDITOR &&
        requiredRole === prismaEnum.JournalRole.COPYEDITOR
    ) {
        return true;
    }

    return false;
}

/**
 * Determine the highest tier among a set of roles.
 * Tiers are ordered: admin > editorial > production > review > support > subscriber
 */
export function highestTier(roles: JournalRoleType[]): RoleTier {
    const TIER_PRIORITY: RoleTier[] = ["admin", "editorial", "production", "review", "support", "subscriber"];
    for (const tier of TIER_PRIORITY) {
        if (roles.some((role) => ROLE_TIER[role] === tier)) return tier;
    }
    return "subscriber";
}

/**
 * Determine the highest authority level among a set of roles.
 */
export function highestLevel(roles: JournalRoleType[]): number {
    if (roles.length === 0) return 0;
    return Math.max(...roles.map((role) => ROLE_HIERARCHY_LEVEL[role]));
}

/**
 * Check whether any role in `heldRoles` satisfies `requiredRole`.
 */
export function anyRoleSatisfies(heldRoles: JournalRoleType[], requiredRole: JournalRoleType): boolean {
    return heldRoles.some((held) => roleSatisfies(held, requiredRole));
}

/**
 * Check whether any role in `heldRoles` satisfies ANY role in `requiredRoles`.
 */
export function anyRoleSatisfiesAny(heldRoles: JournalRoleType[], requiredRoles: JournalRoleType[]): boolean {
    return requiredRoles.some((required) => anyRoleSatisfies(heldRoles, required));
}