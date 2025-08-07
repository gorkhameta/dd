import { pricingPlans, products } from "@/db";
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
            const [product] = await ctx.db
                .select()
                .from(products)
                .where(and(eq(products.id, input.productId), eq(products.organizationId, input.organizationId)))
                .limit(1);
            if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

            const [plan] = await ctx.db.insert(pricingPlans).values(input).returning();
            return plan;
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
            const plan = await ctx.db
                .select({ id: pricingPlans.id })
                .from(pricingPlans)
                .innerJoin(products, eq(pricingPlans.productId, products.id))
                .where(
                    and(
                        eq(pricingPlans.id, input.id),
                        eq(products.organizationId, input.organizationId)
                    )
                )
                .limit(1)
                .then((res) => res[0]);

            if (!plan) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Plan not found or doesn't belong to organization",
                });
            }

            // Step 2: Do the update
            const [updated] = await ctx.db
                .update(pricingPlans)
                .set({ ...input, updatedAt: new Date() })
                .where(eq(pricingPlans.id, input.id))
                .returning();

            return updated;
        }),


    delete: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // Step 1: Validate that pricingPlan with that ID belongs to the correct organization
            const plan = await ctx.db
                .select({ id: pricingPlans.id })
                .from(pricingPlans)
                .innerJoin(products, eq(pricingPlans.productId, products.id))
                .where(
                    and(
                        eq(pricingPlans.id, input.id),
                        eq(products.organizationId, input.organizationId)
                    )
                )
                .limit(1)
                .then((res) => res[0]);

            if (!plan) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found in organization" });
            }

            // Step 2: Delete the pricingPlan
            await ctx.db
                .delete(pricingPlans)
                .where(eq(pricingPlans.id, plan.id));

            return { success: true };
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(pricingPlans)
                .innerJoin(products, eq(products.id, pricingPlans.productId))
                .where(eq(products.organizationId, input.organizationId));
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .query(async ({ ctx, input }) => {
            const [plan] = await ctx.db
                .select()
                .from(pricingPlans)
                .innerJoin(products, eq(products.id, pricingPlans.productId))
                .where(and(eq(pricingPlans.id, input.id), eq(products.organizationId, input.organizationId)))
                .limit(1);

            if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

            return plan.pricing_plans;
        }),
});