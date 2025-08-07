import { members, users } from "@/db";
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
                    id: members.id,
                    userId: members.userId,
                    role: members.role,
                    createdAt: members.createdAt,
                    updatedAt: members.updatedAt,
                    userName: users.name,
                    userEmail: users.email,
                })
                .from(members)
                .innerJoin(users, eq(users.id, members.userId))
                .where(eq(members.organizationId, input.organizationId));
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
            const [member] = await ctx.db
                .update(members)
                .set({ role: input.role, updatedAt: new Date() })
                .where(and(eq(members.id, input.memberId), eq(members.organizationId, input.organizationId)))
                .returning();

            if (!member) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
            }

            return member;
        }),

    remove: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), memberId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const admins = await ctx.db
                .select()
                .from(members)
                .where(and(eq(members.organizationId, input.organizationId), eq(members.role, "admin")));

            if (admins.length === 1 && admins[0].id === input.memberId) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove the last admin" });
            }

            await ctx.db
                .delete(members)
                .where(and(eq(members.id, input.memberId), eq(members.organizationId, input.organizationId)));
            return { success: true };
        }),

});