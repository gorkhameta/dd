import { customers, orders, pricingPlans, products } from "@/db";
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
            const [customer] = await ctx.db
                .select()
                .from(customers)
                .where(and(eq(customers.id, input.customerId), eq(customers.organizationId, input.organizationId)))
                .limit(1);
            if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

            const [plan] = await ctx.db
                .select()
                .from(pricingPlans)
                .innerJoin(products, eq(products.id, pricingPlans.productId))
                .where(and(eq(pricingPlans.id, input.planId), eq(products.organizationId, input.organizationId)))
                .limit(1);
            if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

            const countryCode = customer.countryCode || (await detectCountryFromIP(customer.ipAddress || ""));
            const priceData = await calculatePrice(ctx.db, input.planId, countryCode, input.promotionCode, input.organizationId);

            return await ctx.db.transaction(async (tx) => {
                const [order] = await tx
                    .insert(orders)
                    .values({
                        organizationId: input.organizationId,
                        customerId: input.customerId,
                        productId: plan.pricing_plans.productId,
                        planId: input.planId,
                        status: "pending",
                        baseAmount: priceData.basePrice,
                        discountAmount: priceData.pppDiscount + priceData.promotionDiscount,
                        finalAmount: priceData.finalPrice,
                        currency: plan.pricing_plans.currency,
                        countryCode,
                        pppDiscount: priceData.pppDiscount,
                        promotionCode: input.promotionCode,
                        promotionDiscount: priceData.promotionDiscount,
                    })
                    .returning();

                return order;
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
            const [order] = await ctx.db
                .update(orders)
                .set({ status: input.status, updatedAt: new Date() })
                .where(and(eq(orders.id, input.id), eq(orders.organizationId, input.organizationId)))
                .returning();

            if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

            return order;
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(orders)
                .where(eq(orders.organizationId, input.organizationId));
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .query(async ({ ctx, input }) => {
            const [order] = await ctx.db
                .select()
                .from(orders)
                .where(and(eq(orders.id, input.id), eq(orders.organizationId, input.organizationId)))
                .limit(1);

            if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

            return order;
        }),
});