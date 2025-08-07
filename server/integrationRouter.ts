import { integrations } from "@/db";
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
            const [integration] = await ctx.db
                .insert(integrations)
                .values({
                    ...input,
                    isActive: false,
                })
                .returning();
            return integration;
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
            const [integration] = await ctx.db
                .update(integrations)
                .set({ ...input, updatedAt: new Date() })
                .where(and(eq(integrations.id, input.id), eq(integrations.organizationId, input.organizationId)))
                .returning();

            if (!integration) throw new TRPCError({ code: "NOT_FOUND", message: "Integration not found" });

            return integration;
        }),

    delete: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db
                .delete(integrations)
                .where(and(eq(integrations.id, input.id), eq(integrations.organizationId, input.organizationId)));
            return { success: true };
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(integrations)
                .where(eq(integrations.organizationId, input.organizationId));
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .query(async ({ ctx, input }) => {
            const [integration] = await ctx.db
                .select()
                .from(integrations)
                .where(and(eq(integrations.id, input.id), eq(integrations.organizationId, input.organizationId)))
                .limit(1);

            if (!integration) throw new TRPCError({ code: "NOT_FOUND", message: "Integration not found" });

            return integration;
        }),
});