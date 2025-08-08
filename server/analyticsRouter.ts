import { analyticsEvent, order } from "@/db/schema";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";

export const analyticsRouter = createTRPCRouter({
    trackEvent: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                eventType: z.string(),
                eventData: z.any().optional(),
                customerId: z.string().optional(),
                productId: z.string().optional(),
                orderId: z.string().optional(),
                countryCode: z.string().optional(),
                ipAddress: z.string().optional(),
                userAgent: z.string().optional(),
                referrer: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [event] = await ctx.db
                .insert(analyticsEvent)
                .values({
                    ...input,
                    timestamp: new Date(),
                })
                .returning();
            return event;
        }),

    listEvents: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), eventType: z.string().optional() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(analyticsEvent)
                .where(
                    and(
                        eq(analyticsEvent.organizationId, input.organizationId),
                        input.eventType ? eq(analyticsEvent.eventType, input.eventType) : undefined,
                    ),
                );
        }),

    getRevenueMetrics: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), startDate: z.date(), endDate: z.date() }))
        .query(async ({ ctx, input }) => {
            // Placeholder for revenue metrics calculation (MRR, ARR, churn, LTV)
            const orderData = await ctx.db
                .select()
                .from(order)
                .where(
                    and(
                        eq(order.organizationId, input.organizationId),
                        eq(order.status, "completed"),
                        eq(order.createdAt, input.startDate),
                        eq(order.createdAt, input.endDate),
                    ),
                );

            const totalRevenue = orderData.reduce((sum, orderItem) => sum + orderItem.finalAmount, 0);
            return { totalRevenue, orderCount: orderData.length };
        }),
});