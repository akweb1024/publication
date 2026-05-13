import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { JournalStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class JournalResolverService {
    constructor(@Inject(PrismaService) private readonly prisma: PrismaService) { }

    /**
     * Resolve a journal slug to its ID and slug.
     * Throws NotFoundException if the journal does not exist.
     */
    async resolveSlug<TSelect extends Prisma.JournalSelect>(
        journalSlug: string,
        select?: TSelect
    ): Promise<{ id: string; slug: string } & (TSelect extends undefined ? {} : Prisma.JournalGetPayload<{ select: TSelect }>)> {
        const journal = await this.prisma.journal.findFirst({
            where: { slug: journalSlug },
            select: select ?? { id: true, slug: true } as Prisma.JournalSelect,
        });
        if (!journal) throw new NotFoundException("Journal not found");
        return journal as any;
    }

    /**
     * Resolve a journal slug with a status filter (e.g., only LIVE journals for public routes).
     * Throws NotFoundException if no matching journal is found.
     */
    async resolveSlugWithStatus<TSelect extends Prisma.JournalSelect>(
        journalSlug: string,
        status: JournalStatus,
        select?: TSelect
    ): Promise<{ id: string; slug: string } & (TSelect extends undefined ? {} : Prisma.JournalGetPayload<{ select: TSelect }>)> {
        const journal = await this.prisma.journal.findFirst({
            where: { slug: journalSlug, status },
            select: select ?? { id: true, slug: true } as Prisma.JournalSelect,
        });
        if (!journal) throw new NotFoundException("Journal not found");
        return journal as any;
    }
}