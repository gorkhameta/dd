import { customer, pricingPlan, product, subscription } from "@/db/schema";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure, protectedProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";
import { processPaymentWebhook } from "@/logics/paymentService";


export const billingRouter = createTRPCRouter({

    create: orgAccessProcedure
        .input(
            z.object({
                organizationId: z.string(),
                customerId: z.string(),
                planId: z.string(),
                externalId: z.string().optional(),
                metadata: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // Fetch customer
            const [customerData] = await ctx.db
                .select()
                .from(customer)
                .where(and(eq(customer.id, input.customerId), eq(customer.organizationId, input.organizationId)))
                .limit(1);

            if (!customerData) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

            // Fetch plan joined with product
            const [planData] = await ctx.db
                .select()
                .from(pricingPlan)
                .innerJoin(product, eq(product.id, pricingPlan.productId))
                .where(and(eq(pricingPlan.id, input.planId), eq(product.organizationId, input.organizationId)))
                .limit(1);

            if (!planData) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

            const planDetails = planData.pricing_plan;
            // Safe access with default fallback values:
            const intervalCount = planDetails?.intervalCount ?? 1;  // default 1 month
            const trialDays = planDetails?.trialDays ?? 0;          // default 0 days trial

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + intervalCount);

            // Calculate trial start and end dates only if trialDays > 0
            const trialStart = trialDays > 0 ? now : null;
            const trialEnd = trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;

            const [subscriptionData] = await ctx.db
                .insert(subscription)
                .values({
                    organizationId: input.organizationId,
                    customerId: input.customerId,
                    planId: input.planId,
                    status: trialDays > 0 ? "trialing" : "active",
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    trialStart,
                    trialEnd,
                    externalId: input.externalId ?? null,
                    metadata: input.metadata ?? null,
                })
                .returning();

            return subscriptionData;
        }),


    update: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                id: z.string(),
                planId: z.string().optional(),
                status: z.enum(["active", "cancelled", "past_due", "unpaid", "trialing"]).optional(),
                cancelAtPeriodEnd: z.boolean().optional(),
                metadata: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [subscriptionData] = await ctx.db
                .update(subscription)
                .set({ ...input, updatedAt: new Date() })
                .where(and(eq(subscription.id, input.id), eq(subscription.organizationId, input.organizationId)))
                .returning();

            if (!subscriptionData) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });

            return subscriptionData;
        }),

    cancel: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), id: z.string(), cancelAtPeriodEnd: z.boolean().default(false) }))
        .mutation(async ({ ctx, input }) => {
            const [subscriptionData] = await ctx.db
                .update(subscription)
                .set({
                    status: input.cancelAtPeriodEnd ? "active" : "cancelled",
                    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
                    cancelledAt: input.cancelAtPeriodEnd ? null : new Date(),
                    updatedAt: new Date(),
                })
                .where(and(eq(subscription.id, input.id), eq(subscription.organizationId, input.organizationId)))
                .returning();

            if (!subscriptionData) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });

            return subscriptionData;
        }),

    handleWebhook: protectedProcedure
        .input(
            z.object({
                organizationId: z.string(),
                provider: z.string().default("stripe"),
                payload: z.any(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return await processPaymentWebhook(ctx.db, input.payload, input.organizationId, input.provider);
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(subscription)
                .where(eq(subscription.organizationId, input.organizationId));
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .query(async ({ ctx, input }) => {
            const [subscriptionData] = await ctx.db
                .select()
                .from(subscription)
                .where(and(eq(subscription.id, input.id), eq(subscription.organizationId, input.organizationId)))
                .limit(1);

            if (!subscriptionData) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });

            return subscriptionData;
        }),

    getUserSubscriptions: protectedProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {

            const userId = ctx.auth!.user.id as string;

            return await ctx.db
                .select()
                .from(subscription)
                .innerJoin(customer, eq(customer.id, subscription.customerId))
                .where(and(eq(subscription.organizationId, input.organizationId), eq(customer.email, userId)));
        }),
})