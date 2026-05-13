import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReviewerService } from "../../modules/reviewer/reviewer.service.js";

// Mock prismaEnum from @pub/shared
vi.mock("@pub/shared", () => ({
    prismaEnum: {
        ReviewRecommendation: {
            ACCEPT: "ACCEPT",
            MINOR: "MINOR",
            MAJOR: "MAJOR",
            REJECT: "REJECT",
        },
        ReviewAssignmentStatus: {
            INVITED: "INVITED",
            ACCEPTED: "ACCEPTED",
            DECLINED: "DECLINED",
            OVERDUE: "OVERDUE",
            SUBMITTED: "SUBMITTED",
            CANCELLED: "CANCELLED",
        },
    },
}));

function createPrismaMock() {
    return {
        reviewAssignment: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        review: {
            update: vi.fn(),
        },
    };
}

describe("ReviewerService", () => {
    let service: ReviewerService;
    let prisma: ReturnType<typeof createPrismaMock>;

    beforeEach(() => {
        prisma = createPrismaMock();
        service = new ReviewerService(prisma as any);
    });

    describe("listAssignments", () => {
        it("returns assignments for a reviewer", async () => {
            const mockItems = [
                {
                    id: "a1",
                    status: "INVITED",
                    invitedAt: new Date(),
                    respondBy: new Date(),
                    dueAt: new Date(),
                    reviewRound: {
                        submissionId: "s1",
                        roundNumber: 1,
                        submission: { trackingNumber: "TRK-1", manuscriptTitle: "Test" },
                    },
                },
            ];
            prisma.reviewAssignment.findMany.mockResolvedValue(mockItems);

            const result = await service.listAssignments("user1");
            expect(result.items).toEqual(mockItems);
            expect(prisma.reviewAssignment.findMany).toHaveBeenCalledWith({
                where: { reviewerUserId: "user1" },
                select: expect.any(Object),
                orderBy: { invitedAt: "desc" },
                take: 200,
            });
        });
    });

    describe("respond", () => {
        it("accepts an INVITED assignment", async () => {
            prisma.reviewAssignment.findUnique.mockResolvedValue({
                id: "a1",
                reviewerUserId: "user1",
                status: "INVITED",
            });
            prisma.reviewAssignment.update.mockResolvedValue({ id: "a1", status: "ACCEPTED" });

            const result = await service.respond("a1", "user1", "accept");
            expect(result.ok).toBe(true);
            expect(prisma.reviewAssignment.update).toHaveBeenCalledWith({
                where: { id: "a1" },
                data: { status: "ACCEPTED", acceptedAt: expect.any(Date) },
            });
        });

        it("declines an INVITED assignment", async () => {
            prisma.reviewAssignment.findUnique.mockResolvedValue({
                id: "a1",
                reviewerUserId: "user1",
                status: "INVITED",
            });
            prisma.reviewAssignment.update.mockResolvedValue({ id: "a1", status: "DECLINED" });

            const result = await service.respond("a1", "user1", "decline");
            expect(result.ok).toBe(true);
            expect(prisma.reviewAssignment.update).toHaveBeenCalledWith({
                where: { id: "a1" },
                data: { status: "DECLINED" },
            });
        });

        it("throws ForbiddenException if user is not the assigned reviewer", async () => {
            prisma.reviewAssignment.findUnique.mockResolvedValue({
                id: "a1",
                reviewerUserId: "user2",
                status: "INVITED",
            });

            await expect(service.respond("a1", "user1", "accept")).rejects.toThrow("Forbidden");
        });

        it("throws BadRequestException if assignment is already responded", async () => {
            prisma.reviewAssignment.findUnique.mockResolvedValue({
                id: "a1",
                reviewerUserId: "user1",
                status: "ACCEPTED",
            });

            await expect(service.respond("a1", "user1", "accept")).rejects.toThrow("Already responded");
        });

        it("throws NotFoundException if assignment does not exist", async () => {
            prisma.reviewAssignment.findUnique.mockResolvedValue(null);

            await expect(service.respond("a1", "user1", "accept")).rejects.toThrow("Assignment not found");
        });
    });

    describe("submitReview", () => {
        it("submits a review for an ACCEPTED assignment", async () => {
            prisma.reviewAssignment.findUnique.mockResolvedValue({
                id: "a1",
                reviewerUserId: "user1",
                status: "ACCEPTED",
            });
            prisma.review.update.mockResolvedValue({});
            prisma.reviewAssignment.update.mockResolvedValue({ id: "a1", status: "SUBMITTED" });

            const result = await service.submitReview("a1", "user1", {
                recommendation: "MINOR",
                commentsToAuthor: "Good work, minor revisions needed",
                commentsToEditor: "Relevant contribution",
            });
            expect(result.ok).toBe(true);
            expect(prisma.review.update).toHaveBeenCalledWith({
                where: { reviewAssignmentId: "a1" },
                data: {
                    submittedAt: expect.any(Date),
                    recommendation: "MINOR",
                    commentsToAuthor: "Good work, minor revisions needed",
                    commentsToEditor: "Relevant contribution",
                },
            });
            expect(prisma.reviewAssignment.update).toHaveBeenCalledWith({
                where: { id: "a1" },
                data: { status: "SUBMITTED" },
            });
        });

        it("throws ForbiddenException if user is not the assigned reviewer", async () => {
            prisma.reviewAssignment.findUnique.mockResolvedValue({
                id: "a1",
                reviewerUserId: "user2",
                status: "ACCEPTED",
            });

            await expect(service.submitReview("a1", "user1", {
                recommendation: "ACCEPT",
                commentsToAuthor: "ok",
            })).rejects.toThrow("Forbidden");
        });

        it("throws BadRequestException if assignment status is not ACCEPTED or OVERDUE", async () => {
            prisma.reviewAssignment.findUnique.mockResolvedValue({
                id: "a1",
                reviewerUserId: "user1",
                status: "INVITED",
            });

            await expect(service.submitReview("a1", "user1", {
                recommendation: "ACCEPT",
                commentsToAuthor: "ok",
            })).rejects.toThrow("Assignment not accepted");
        });
    });
});