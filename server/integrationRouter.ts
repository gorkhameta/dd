import { integration } from "@/db/schema";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";

export const integrationRouter = createTRPCRouter({
    create: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                provider: z.string(),
                name: z.string(),
                credentials: z.record(z.string(), z.string()),
                webhookUrl: z.string().optional(),
                webhookSecret: z.string().optional(),
                settings: z.record(z.string(), z.string()).optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [integrationResult] = await ctx.db
                .insert(integration)
                .values({
                    ...input,
                    isActive: false,
                })
                .returning();
            return integrationResult;
        }),

    update: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                id: z.string(),
                provider: z.string().optional(),
                name: z.string().optional(),
                credentials: z.record(z.string(), z.string()).optional(),
                webhookUrl: z.string().optional(),
                webhookSecret: z.string().optional(),
                settings: z.record(z.string(), z.string()).optional(),
                isActive: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [integrationResult] = await ctx.db
                .update(integration)
                .set({ ...input, updatedAt: new Date() })
                .where(and(eq(integration.id, input.id), eq(integration.organizationId, input.organizationId)))
                .returning();

            if (!integrationResult) throw new TRPCError({ code: "NOT_FOUND", message: "Integration not found" });

            return integrationResult;
        }),

    delete: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db
                .delete(integration)
                .where(and(eq(integration.id, input.id), eq(integration.organizationId, input.organizationId)));
            return { success: true };
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(integration)
                .where(eq(integration.organizationId, input.organizationId));
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .query(async ({ ctx, input }) => {
            const [integrationResult] = await ctx.db
                .select()
                .from(integration)
                .where(and(eq(integration.id, input.id), eq(integration.organizationId, input.organizationId)))
                .limit(1);

            if (!integrationResult) throw new TRPCError({ code: "NOT_FOUND", message: "Integration not found" });

            return integrationResult;
        }),
});