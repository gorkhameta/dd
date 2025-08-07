import { customers, pricingPlans, products, subscriptions } from "@/db";
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
            const [customer] = await ctx.db
                .select()
                .from(customers)
                .where(and(eq(customers.id, input.customerId), eq(customers.organizationId, input.organizationId)))
                .limit(1);

            if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

            // Fetch plan joined with product
            const [plan] = await ctx.db
                .select()
                .from(pricingPlans)
                .innerJoin(products, eq(products.id, pricingPlans.productId))
                .where(and(eq(pricingPlans.id, input.planId), eq(products.organizationId, input.organizationId)))
                .limit(1);

            if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

            const pricingPlan = plan.pricing_plans;
            // Safe access with default fallback values:
            const intervalCount = pricingPlan?.intervalCount ?? 1;  // default 1 month
            const trialDays = pricingPlan?.trialDays ?? 0;          // default 0 days trial

            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + intervalCount);

            // Calculate trial start and end dates only if trialDays > 0
            const trialStart = trialDays > 0 ? now : null;
            const trialEnd = trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;

            const [subscription] = await ctx.db
                .insert(subscriptions)
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

            return subscription;
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
            const [subscription] = await ctx.db
                .update(subscriptions)
                .set({ ...input, updatedAt: new Date() })
                .where(and(eq(subscriptions.id, input.id), eq(subscriptions.organizationId, input.organizationId)))
                .returning();

            if (!subscription) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });

            return subscription;
        }),

    cancel: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), id: z.string(), cancelAtPeriodEnd: z.boolean().default(false) }))
        .mutation(async ({ ctx, input }) => {
            const [subscription] = await ctx.db
                .update(subscriptions)
                .set({
                    status: input.cancelAtPeriodEnd ? "active" : "cancelled",
                    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
                    cancelledAt: input.cancelAtPeriodEnd ? null : new Date(),
                    updatedAt: new Date(),
                })
                .where(and(eq(subscriptions.id, input.id), eq(subscriptions.organizationId, input.organizationId)))
                .returning();

            if (!subscription) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });

            return subscription;
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
                .from(subscriptions)
                .where(eq(subscriptions.organizationId, input.organizationId));
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .query(async ({ ctx, input }) => {
            const [subscription] = await ctx.db
                .select()
                .from(subscriptions)
                .where(and(eq(subscriptions.id, input.id), eq(subscriptions.organizationId, input.organizationId)))
                .limit(1);

            if (!subscription) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });

            return subscription;
        }),

    getUserSubscriptions: protectedProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {

            const userId = ctx.auth!.user.id as string;

            return await ctx.db
                .select()
                .from(subscriptions)
                .innerJoin(customers, eq(customers.id, subscriptions.customerId))
                .where(and(eq(subscriptions.organizationId, input.organizationId), eq(customers.email, userId)));
        }),
})