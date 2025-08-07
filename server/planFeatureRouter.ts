import { features, planFeatures, pricingPlans, products } from "@/db";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";



export const planFeatureRouter = createTRPCRouter({
    assign: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                planId: z.string(),
                featureId: z.string(),
                value: z.any(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [plan] = await ctx.db
                .select()
                .from(pricingPlans)
                .innerJoin(products, eq(products.id, pricingPlans.productId))
                .where(and(eq(pricingPlans.id, input.planId), eq(products.organizationId, input.organizationId)))
                .limit(1);
            if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

            const [feature] = await ctx.db
                .select()
                .from(features)
                .where(and(eq(features.id, input.featureId), eq(features.organizationId, input.organizationId)))
                .limit(1);
            if (!feature) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });

            const [planFeature] = await ctx.db
                .insert(planFeatures)
                .values({
                    planId: input.planId,
                    featureId: input.featureId,
                    value: input.value,
                })
                .returning();
            return planFeature;
        }),

    update: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                planId: z.string(),
                featureId: z.string(),
                value: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // Step 1: Validate ownership by joining tables
            const planFeature = await ctx.db
                .select()
                .from(planFeatures)
                .innerJoin(pricingPlans, eq(pricingPlans.id, planFeatures.planId))
                .innerJoin(products, eq(products.id, pricingPlans.productId))
                .where(
                    and(
                        eq(planFeatures.planId, input.planId),
                        eq(planFeatures.featureId, input.featureId),
                        eq(products.organizationId, input.organizationId),
                    ),
                )
                .limit(1)
                .then((res) => res[0]);

            if (!planFeature) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Plan feature not found" });
            }

            // Step 2: Update the record by its PK
            const [updated] = await ctx.db
                .update(planFeatures)
                .set({ value: input.value })
                .where(
                    and(
                        eq(planFeatures.planId, input.planId),
                        eq(planFeatures.featureId, input.featureId),
                    ),
                )
                .returning();

            return updated;
        }),


    remove: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), planId: z.string(), featureId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // Step 1: Validate ownership
            const planFeature = await ctx.db
                .select()
                .from(planFeatures)
                .innerJoin(pricingPlans, eq(pricingPlans.id, planFeatures.planId))
                .innerJoin(products, eq(products.id, pricingPlans.productId))
                .where(
                    and(
                        eq(planFeatures.planId, input.planId),
                        eq(planFeatures.featureId, input.featureId),
                        eq(products.organizationId, input.organizationId),
                    ),
                )
                .limit(1)
                .then((res) => res[0]);

            if (!planFeature) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Plan feature not found" });
            }

            // Step 2: Delete the record
            await ctx.db
                .delete(planFeatures)
                .where(
                    and(
                        eq(planFeatures.planId, input.planId),
                        eq(planFeatures.featureId, input.featureId),
                    ),
                );

            return { success: true };
        }),


    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), planId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(planFeatures)
                .innerJoin(pricingPlans, eq(pricingPlans.id, planFeatures.planId))
                .innerJoin(products, eq(products.id, pricingPlans.productId))
                .where(and(eq(planFeatures.planId, input.planId), eq(products.organizationId, input.organizationId)));
        }),
});