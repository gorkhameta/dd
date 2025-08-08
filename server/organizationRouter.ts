import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";
import { organization, member, user } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createOrganizationSchema } from "@/modules/organization/schema";

export const organizationRouter = createTRPCRouter({
    create: protectedProcedure
        .input(createOrganizationSchema)
        .mutation(async ({ ctx, input }) => {
            
            const userId = ctx.auth!.session.userId as string;
            const existingAdminOrg = await ctx.db.query.member.findFirst({
                where: and(eq(member.userId, userId), eq(member.role, "admin")),
            });

            if (existingAdminOrg) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You can only create one organization as admin.",
                });
            }

            // Update user with firstName and lastName
            await ctx.db
                .update(user)
                .set({
                    name:input.firstName,
                    lastName: input.lastName,
                })
                .where(eq(user.id, userId));

            return await ctx.db.transaction(async (tx) => {
                const [org] = await tx
                    .insert(organization)
                    .values({
                        name: input.name,
                        size: input.size,
                        howHeard: input.howHeard,
                    })
                    .returning();

                await tx.insert(member).values({
                    organizationId: org.id,
                    userId,
                    role: "admin", 
                });

                return org;
            });
        }),

    getOne: protectedProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            const [org] = await ctx.db
                .select()
                .from(organization)
                .where(eq(organization.id, input.organizationId))
                .limit(1);

            if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

            return org;
        }),

    getMany: protectedProcedure.query(async ({ ctx }) => {
        const userId = ctx.auth!.session.userId as string;

        return await ctx.db
            .select({
                id: organization.id,
                name: organization.name,
                size: organization.size,
                howHeard: organization.howHeard,
                createdAt: organization.createdAt,
                updatedAt: organization.updatedAt,
            })
            .from(organization)
            .innerJoin(member, eq(member.organizationId, organization.id))
            .where(eq(member.userId, userId));
    }),
});
