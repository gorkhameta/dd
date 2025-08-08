import { customer, order, pricingPlan, product } from "@/db/schema";
import { detectCountryFromIP } from "@/logics/pppService";
import { calculatePrice } from "@/logics/pricingService";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure, protectedProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";

export const orderRouter = createTRPCRouter({
    create: protectedProcedure
        .input(
            z.object({
                organizationId: z.string(),
                customerId: z.string(),
                planId: z.string(),
                promotionCode: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [customerResult] = await ctx.db
                .select()
                .from(customer)
                .where(and(eq(customer.id, input.customerId), eq(customer.organizationId, input.organizationId)))
                .limit(1);
            if (!customerResult) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

            const [plan] = await ctx.db
                .select()
                .from(pricingPlan)
                .innerJoin(product, eq(product.id, pricingPlan.productId))
                .where(and(eq(pricingPlan.id, input.planId), eq(product.organizationId, input.organizationId)))
                .limit(1);
            if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

            const countryCode = customerResult.countryCode || (await detectCountryFromIP(customerResult.ipAddress || ""));
            const priceData = await calculatePrice(ctx.db, input.planId, countryCode, input.promotionCode, input.organizationId);

            return await ctx.db.transaction(async (tx) => {
                const [orderResult] = await tx
                    .insert(order)
                    .values({
                        organizationId: input.organizationId,
                        customerId: input.customerId,
                        productId: plan.pricing_plan.productId,
                        planId: input.planId,
                        status: "pending",
                        baseAmount: priceData.basePrice,
                        discountAmount: priceData.pppDiscount + priceData.promotionDiscount,
                        finalAmount: priceData.finalPrice,
                        currency: plan.pricing_plan.currency,
                        countryCode,
                        pppDiscount: priceData.pppDiscount,
                        promotionCode: input.promotionCode,
                        promotionDiscount: priceData.promotionDiscount,
                    })
                    .returning();

                return orderResult;
            });
        }),

    updateStatus: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                id: z.string(),
                status: z.enum(["pending", "completed", "failed", "refunded", "cancelled"]),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [orderResult] = await ctx.db
                .update(order)
                .set({ status: input.status, updatedAt: new Date() })
                .where(and(eq(order.id, input.id), eq(order.organizationId, input.organizationId)))
                .returning();

            if (!orderResult) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

            return orderResult;
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(order)
                .where(eq(order.organizationId, input.organizationId));
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .query(async ({ ctx, input }) => {
            const [orderResult] = await ctx.db
                .select()
                .from(order)
                .where(and(eq(order.id, input.id), eq(order.organizationId, input.organizationId)))
                .limit(1);

            if (!orderResult) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

            return orderResult;
        }),
});