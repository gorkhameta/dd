import { feature } from "@/db/schema";
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
            const [featureResult] = await ctx.db.insert(feature).values(input).returning();
            return featureResult;
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
            const [featureResult] = await ctx.db
                .update(feature)
                .set({ ...input, updatedAt: new Date() })
                .where(and(eq(feature.id, input.id), eq(feature.organizationId, input.organizationId)))
                .returning();

            if (!featureResult) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });

            return featureResult;
        }),

    delete: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db
                .delete(feature)
                .where(and(eq(feature.id, input.id), eq(feature.organizationId, input.organizationId)));
            return { success: true };
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(feature)
                .where(eq(feature.organizationId, input.organizationId));
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .query(async ({ ctx, input }) => {
            const [featureResult] = await ctx.db
                .select()
                .from(feature)
                .where(and(eq(feature.id, input.id), eq(feature.organizationId, input.organizationId)))
                .limit(1);

            if (!featureResult) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });

            return featureResult;
        }),
});