import { feature, planFeature, pricingPlan, product } from "@/db/schema";
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
                .from(pricingPlan)
                .innerJoin(product, eq(product.id, pricingPlan.productId))
                .where(and(eq(pricingPlan.id, input.planId), eq(product.organizationId, input.organizationId)))
                .limit(1);
            if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

            const [featureResult] = await ctx.db
                .select()
                .from(feature)
                .where(and(eq(feature.id, input.featureId), eq(feature.organizationId, input.organizationId)))
                .limit(1);
            if (!featureResult) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });

            const [planFeatureResult] = await ctx.db
                .insert(planFeature)
                .values({
                    planId: input.planId,
                    featureId: input.featureId,
                    value: input.value,
                })
                .returning();
            return planFeatureResult;
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
            const planFeatureResult = await ctx.db
                .select()
                .from(planFeature)
                .innerJoin(pricingPlan, eq(pricingPlan.id, planFeature.planId))
                .innerJoin(product, eq(product.id, pricingPlan.productId))
                .where(
                    and(
                        eq(planFeature.planId, input.planId),
                        eq(planFeature.featureId, input.featureId),
                        eq(product.organizationId, input.organizationId),
                    ),
                )
                .limit(1)
                .then((res) => res[0]);

            if (!planFeatureResult) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Plan feature not found" });
            }

            // Step 2: Update the record by its PK
            const [updated] = await ctx.db
                .update(planFeature)
                .set({ value: input.value })
                .where(
                    and(
                        eq(planFeature.planId, input.planId),
                        eq(planFeature.featureId, input.featureId),
                    ),
                )
                .returning();

            return updated;
        }),

    remove: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), planId: z.string(), featureId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // Step 1: Validate ownership
            const planFeatureResult = await ctx.db
                .select()
                .from(planFeature)
                .innerJoin(pricingPlan, eq(pricingPlan.id, planFeature.planId))
                .innerJoin(product, eq(product.id, pricingPlan.productId))
                .where(
                    and(
                        eq(planFeature.planId, input.planId),
                        eq(planFeature.featureId, input.featureId),
                        eq(product.organizationId, input.organizationId),
                    ),
                )
                .limit(1)
                .then((res) => res[0]);

            if (!planFeatureResult) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Plan feature not found" });
            }

            // Step 2: Delete the record
            await ctx.db
                .delete(planFeature)
                .where(
                    and(
                        eq(planFeature.planId, input.planId),
                        eq(planFeature.featureId, input.featureId),
                    ),
                );

            return { success: true };
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), planId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(planFeature)
                .innerJoin(pricingPlan, eq(pricingPlan.id, planFeature.planId))
                .innerJoin(product, eq(product.id, pricingPlan.productId))
                .where(and(eq(planFeature.planId, input.planId), eq(product.organizationId, input.organizationId)));
        }),
});
