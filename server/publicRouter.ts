import { pricingPlan, pricingTablePlan, pricingTable, product } from "@/db/schema";
import { createTRPCRouter, orgAccessProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";

export const publicRouter = createTRPCRouter({
    getPricingTable: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), pricingTableId: z.string() }))
        .query(async ({ ctx, input }) => {
            const [pricingTableResult] = await ctx.db
                .select()
                .from(pricingTable)
                .where(
                    and(
                        eq(pricingTable.id, input.pricingTableId),
                        eq(pricingTable.organizationId, input.organizationId),
                    ),
                )
                .limit(1);

            if (!pricingTableResult) throw new TRPCError({ code: "NOT_FOUND", message: "Pricing table not found" });

            const plans = await ctx.db
                .select()
                .from(pricingPlan)
                .innerJoin(pricingTablePlan, eq(pricingTablePlan.planId, pricingPlan.id))
                .innerJoin(product, eq(product.id, pricingPlan.productId))
                .where(
                    and(
                        eq(pricingTablePlan.pricingTableId, input.pricingTableId),
                        eq(product.organizationId, input.organizationId),
                    ),
                );

            return { ...pricingTableResult, plans: plans.map((p) => p.pricing_plan) };
        }),

    listPricingTables: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(pricingTable)
                .where(eq(pricingTable.organizationId, input.organizationId));
        }),
});