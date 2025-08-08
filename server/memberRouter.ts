import { member, user } from "@/db/schema";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import z from "zod";

export const memberRouter = createTRPCRouter({
    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select({
                    id: member.id,
                    userId: member.userId,
                    role: member.role,
                    createdAt: member.createdAt,
                    updatedAt: member.updatedAt,
                    userEmail: user.email,
                })
                .from(member)
                .innerJoin(user, eq(user.id, member.userId))
                .where(eq(member.organizationId, input.organizationId));
        }),

    updateRole: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                memberId: z.string(),
                role: z.enum(["admin", "member"]),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [memberResult] = await ctx.db
                .update(member)
                .set({ role: input.role, updatedAt: new Date() })
                .where(and(eq(member.id, input.memberId), eq(member.organizationId, input.organizationId)))
                .returning();

            if (!memberResult) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
            }

            return memberResult;
        }),

    remove: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), memberId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const admins = await ctx.db
                .select()
                .from(member)
                .where(and(eq(member.organizationId, input.organizationId), eq(member.role, "admin")));

            if (admins.length === 1 && admins[0].id === input.memberId) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove the last admin" });
            }

            await ctx.db
                .delete(member)
                .where(and(eq(member.id, input.memberId), eq(member.organizationId, input.organizationId)));
            return { success: true };
        }),
});

