
import { pricingPlan, product } from "@/db/schema";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";

export const planRouter = createTRPCRouter({
    create: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                productId: z.string(),
                name: z.string().min(1),
                description: z.string().optional(),
                price: z.number().int().min(0),
                currency: z.string().default("USD"),
                interval: z.string(),
                intervalCount: z.number().int().min(1).default(1),
                trialDays: z.number().int().min(0).default(0),
                isPopular: z.boolean().default(false),
                sortOrder: z.number().int().default(0),
                status: z.string().default("active"),
                metadata: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [singleProduct] = await ctx.db
                .select()
                .from(product)
                .where(and(eq(product.id, input.productId), eq(product.organizationId, input.organizationId)))
                .limit(1);
            if (!singleProduct) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

            const [newPlan] = await ctx.db.insert(pricingPlan).values(input).returning();
            return newPlan;
        }),

    update: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                id: z.string(),
                productId: z.string().optional(),
                name: z.string().optional(),
                description: z.string().optional(),
                price: z.number().int().min(0).optional(),
                currency: z.string().optional(),
                interval: z.string().optional(),
                intervalCount: z.number().int().min(1).optional(),
                trialDays: z.number().int().min(0).optional(),
                isPopular: z.boolean().optional(),
                sortOrder: z.number().int().optional(),
                status: z.string().optional(),
                metadata: z.any().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            // Step 1: Ensure this plan belongs to a product in the organization
            const singlePlan = await ctx.db
                .select({ id: pricingPlan.id })
                .from(pricingPlan)
                .innerJoin(product, eq(pricingPlan.productId, product.id))
                .where(
                    and(
                        eq(pricingPlan.id, input.id),
                        eq(product.organizationId, input.organizationId)
                    )
                )
                .limit(1)
                .then((res) => res[0]);

            if (!singlePlan) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Plan not found or doesn't belong to organization",
                });
            }

            // Step 2: Do the update
            const [updatedPlan] = await ctx.db
                .update(pricingPlan)
                .set({ ...input, updatedAt: new Date() })
                .where(eq(pricingPlan.id, input.id))
                .returning();

            return updatedPlan;
        }),

    delete: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // Step 1: Validate that pricingPlan with that ID belongs to the correct organization
            const singlePlan = await ctx.db
                .select({ id: pricingPlan.id })
                .from(pricingPlan)
                .innerJoin(product, eq(pricingPlan.productId, product.id))
                .where(
                    and(
                        eq(pricingPlan.id, input.id),
                        eq(product.organizationId, input.organizationId)
                    )
                )
                .limit(1)
                .then((res) => res[0]);

            if (!singlePlan) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found in organization" });
            }

            // Step 2: Delete the pricingPlan
            await ctx.db
                .delete(pricingPlan)
                .where(eq(pricingPlan.id, singlePlan.id));

            return { success: true };
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(pricingPlan)
                .innerJoin(product, eq(product.id, pricingPlan.productId))
                .where(eq(product.organizationId, input.organizationId));
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .query(async ({ ctx, input }) => {
            const [singlePlan] = await ctx.db
                .select()
                .from(pricingPlan)
                .innerJoin(product, eq(product.id, pricingPlan.productId))
                .where(and(eq(pricingPlan.id, input.id), eq(product.organizationId, input.organizationId)))
                .limit(1);

            if (!singlePlan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

            return singlePlan.pricing_plan;
        }),
});