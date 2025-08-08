import { invitation, member } from "@/db/schema";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure, protectedProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";
import { authClient } from "@/lib/auth-client";

export const invitationRouter = createTRPCRouter({
    create: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                email: z.string().email(),
                role: z.enum(["admin", "member"]).default("member"),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.auth!.session.userId as string;

            return await ctx.db.transaction(async (tx) => {
                const [invitationResult] = await tx
                    .insert(invitation)
                    .values({
                        organizationId: input.organizationId,
                        email: input.email,
                        role: input.role,
                        inviterId: userId,
                        status: "pending",
                    })
                    .returning();

                await authClient.organization.inviteMember({
                    email: input.email,
                    role: input.role,
                    organizationId: input.organizationId,
                });

                return invitationResult;
            });
        }),

    accept: protectedProcedure
        .input(z.object({ invitationId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return await ctx.db.transaction(async (tx) => {
                const userId = ctx.auth!.session.userId as string;

                const [invitationResult] = await tx
                    .select()
                    .from(invitation)
                    .where(and(eq(invitation.id, input.invitationId), eq(invitation.status, "pending")))
                    .limit(1);

                if (!invitationResult) {
                    throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found or expired" });
                }

                const sessionEmail = ctx.auth!.user.email as string;

                if (invitationResult.email !== sessionEmail) {
                    throw new TRPCError({ code: "FORBIDDEN", message: "Invitation email does not match user" });
                }

                await tx.insert(member).values({
                    organizationId: invitationResult.organizationId,
                    userId: userId,
                    role: invitationResult.role,
                });

                await tx
                    .update(invitation)
                    .set({ status: "accepted", updatedAt: new Date() })
                    .where(eq(invitation.id, input.invitationId));

                return { success: true };
            });
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select({
                    id: invitation.id,
                    email: invitation.email,
                    role: invitation.role,
                    status: invitation.status,
                    inviterId: invitation.inviterId,
                    createdAt: invitation.createdAt,
                    updatedAt: invitation.updatedAt,
                })
                .from(invitation)
                .where(eq(invitation.organizationId, input.organizationId));
        }),

    revoke: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), invitationId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db
                .update(invitation)
                .set({ status: "revoked", updatedAt: new Date() })
                .where(
                    and(eq(invitation.id, input.invitationId), eq(invitation.organizationId, input.organizationId)),
                );
            return { success: true };
        }),
});