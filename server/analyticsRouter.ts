import { analyticsEvents, countries, customers, orders } from "@/db";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";


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
                .insert(analyticsEvents)
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
                .from(analyticsEvents)
                .where(
                    and(
                        eq(analyticsEvents.organizationId, input.organizationId),
                        input.eventType ? eq(analyticsEvents.eventType, input.eventType) : undefined,
                    ),
                );
        }),

    getRevenueMetrics: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), startDate: z.date(), endDate: z.date() }))
        .query(async ({ ctx, input }) => {
            // Placeholder for revenue metrics calculation (MRR, ARR, churn, LTV)
            const order = await ctx.db
                .select()
                .from(orders)
                .where(
                    and(
                        eq(orders.organizationId, input.organizationId),
                        eq(orders.status, "completed"),
                        eq(orders.createdAt, input.startDate),
                        eq(orders.createdAt, input.endDate),
                    ),
                );

            const totalRevenue = order.reduce((sum, order) => sum + order.finalAmount, 0);
            return { totalRevenue, orderCount: order.length };
        }),
});