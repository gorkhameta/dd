import { features } from "@/db";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";


export const featureRouter = createTRPCRouter({
    create: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                slug: z.string().min(1),
                name: z.string().min(1),
                description: z.string().optional(),
                type: z.enum(["boolean", "numeric", "text"]).default("boolean"),
                metadata: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [feature] = await ctx.db.insert(features).values(input).returning();
            return feature;
        }),

    update: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                id: z.string(),
                slug: z.string().optional(),
                name: z.string().optional(),
                description: z.string().optional(),
                type: z.enum(["boolean", "numeric", "text"]).optional(),
                metadata: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [feature] = await ctx.db
                .update(features)
                .set({ ...input, updatedAt: new Date() })
                .where(and(eq(features.id, input.id), eq(features.organizationId, input.organizationId)))
                .returning();

            if (!feature) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });

            return feature;
        }),

    delete: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db
                .delete(features)
                .where(and(eq(features.id, input.id), eq(features.organizationId, input.organizationId)));
            return { success: true };
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(features)
                .where(eq(features.organizationId, input.organizationId));
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .query(async ({ ctx, input }) => {
            const [feature] = await ctx.db
                .select()
                .from(features)
                .where(and(eq(features.id, input.id), eq(features.organizationId, input.organizationId)))
                .limit(1);

            if (!feature) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });

            return feature;
        }),
});