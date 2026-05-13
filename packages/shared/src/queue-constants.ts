export const QUEUE_EMAIL = "email";

export type EmailJob = {
    to: string[];
    subject: string;
    html: string;
};