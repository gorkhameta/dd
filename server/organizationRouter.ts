import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure, protectedProcedure } from "@/trpc/init";
import { z } from "zod";
import { organizations, members } from "@/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const organizationRouter = createTRPCRouter({
    create: protectedProcedure
        .input(
            z.object({
                name: z.string(),
                slug: z.string(),
                logo: z.string().optional(),
                metadata: z.any().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {

            const existing = await ctx.db.query.organizations.findFirst({
                where: eq(organizations.slug, input.slug),
            });

            if (existing) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "Required Unique",
                });
            }
            return await ctx.db.transaction(async (tx) => {
                const [org] = await tx
                    .insert(organizations)
                    .values({
                        name: input.name,
                        slug: input.slug,
                        logo: input.logo,
                        metadata: input.metadata,
                    })
                    .returning();

                const userId = ctx.auth!.session.userId as string;

                await tx.insert(members).values({
                    organizationId: org.id,
                    userId,
                    role: "admin",
                });

                return org;
            });
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            const [org] = await ctx.db
                .select()
                .from(organizations)
                .where(eq(organizations.id, input.organizationId))
                .limit(1);

            if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

            return org;
        }),

    update: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                name: z.string().optional(),
                logo: z.string().optional(),
                metadata: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [org] = await ctx.db
                .update(organizations)
                .set({
                    name: input.name,
                    logo: input.logo,
                    metadata: input.metadata,
                    updatedAt: new Date(),
                })
                .where(eq(organizations.id, input.organizationId))
                .returning();

            if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

            return org;
        }),

    delete: orgAdminProcedure
        .input(z.object({ organizationId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.delete(organizations).where(eq(organizations.id, input.organizationId));
            return { success: true };
        }),

    getUserOrganizations: protectedProcedure.query(async ({ ctx }) => {

        const userId = ctx.auth!.session.userId as string;

        return await ctx.db
            .select({
                id: organizations.id,
                name: organizations.name,
                slug: organizations.slug,
                logo: organizations.logo,
                metadata: organizations.metadata,
                createdAt: organizations.createdAt,
                updatedAt: organizations.updatedAt,
            })
            .from(organizations)
            .innerJoin(members, eq(members.organizationId, organizations.id))
            .where(eq(members.userId, userId));
    }),
});
