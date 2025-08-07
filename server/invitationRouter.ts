import { invitations, members } from "@/db";
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
                const [invitation] = await tx
                    .insert(invitations)
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

                return invitation;
            });
        }),

    accept: protectedProcedure
        .input(z.object({ invitationId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return await ctx.db.transaction(async (tx) => {

                const userId = ctx.auth!.session.userId as string;

                const [invitation] = await tx
                    .select()
                    .from(invitations)
                    .where(and(eq(invitations.id, input.invitationId), eq(invitations.status, "pending")))
                    .limit(1);

                if (!invitation) {
                    throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found or expired" });
                }

                const sessionEmail = ctx.auth!.user.email as string;

                if (invitation.email !== sessionEmail) {
                    throw new TRPCError({ code: "FORBIDDEN", message: "Invitation email does not match user" });
                }

                await tx.insert(members).values({
                    organizationId: invitation.organizationId,
                    userId: userId,
                    role: invitation.role,
                });

                await tx
                    .update(invitations)
                    .set({ status: "accepted", updatedAt: new Date() })
                    .where(eq(invitations.id, input.invitationId));

                return { success: true };
            });
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select({
                    id: invitations.id,
                    email: invitations.email,
                    role: invitations.role,
                    status: invitations.status,
                    inviterId: invitations.inviterId,
                    createdAt: invitations.createdAt,
                    updatedAt: invitations.updatedAt,
                })
                .from(invitations)
                .where(eq(invitations.organizationId, input.organizationId));
        }),

    revoke: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), invitationId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db
                .update(invitations)
                .set({ status: "revoked", updatedAt: new Date() })
                .where(
                    and(eq(invitations.id, input.invitationId), eq(invitations.organizationId, input.organizationId)),
                );
            return { success: true };
        }),
});