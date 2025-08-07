import { pricingPlans, pricingTablePlans, pricingTables, products } from "@/db";
import { createTRPCRouter, orgAccessProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";


export const publicRouter = createTRPCRouter({
    getPricingTable: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), pricingTableId: z.string() }))
        .query(async ({ ctx, input }) => {
            const [pricingTable] = await ctx.db
                .select()
                .from(pricingTables)
                .where(
                    and(
                        eq(pricingTables.id, input.pricingTableId),
                        eq(pricingTables.organizationId, input.organizationId),
                    ),
                )
                .limit(1);

            if (!pricingTable) throw new TRPCError({ code: "NOT_FOUND", message: "Pricing table not found" });

            const plans = await ctx.db
                .select()
                .from(pricingPlans)
                .innerJoin(pricingTablePlans, eq(pricingTablePlans.planId, pricingPlans.id))
                .innerJoin(products, eq(products.id, pricingPlans.productId))
                .where(
                    and(
                        eq(pricingTablePlans.pricingTableId, input.pricingTableId),
                        eq(products.organizationId, input.organizationId),
                    ),
                );

            return { ...pricingTable, plans: plans.map((p) => p.pricing_plans) };
        }),

    listPricingTables: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(pricingTables)
                .where(eq(pricingTables.organizationId, input.organizationId));
        }),
});