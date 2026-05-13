/**
 * Default admin email utility.
 *
 * The default admin email is no longer hardcoded — it is read from
 * the DEFAULT_ADMIN_EMAIL environment variable. This allows different
 * environments (dev, staging, prod) to use different super-admin emails,
 * and avoids leaking real email addresses into source code.
 */

/** Returns the default admin email from env, or empty string if not set. */
export function getDefaultAdminEmail(): string {
    return (process.env.DEFAULT_ADMIN_EMAIL ?? "").trim().toLowerCase();
}

/** Checks if the given email matches the default admin. */
export function isDefaultAdminEmail(email: string | null | undefined): boolean {
    return (email ?? "").trim().toLowerCase() === getDefaultAdminEmail();
}