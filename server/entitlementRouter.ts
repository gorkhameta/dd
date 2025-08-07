import { invitations, members } from "@/db";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure, protectedProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";
import { authClient } from "@/lib/auth-client";
import { customers, entitlements, features } from "@/db";
import { checkFeatureAccess } from "@/logics/entitlementService";

export const entitlementRouter = createTRPCRouter({
    create: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                customerId: z.string(),
                featureId: z.string(),
                value: z.any(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [customer] = await ctx.db
                .select()
                .from(customers)
                .where(and(eq(customers.id, input.customerId), eq(customers.organizationId, input.organizationId)))
                .limit(1);
            if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

            const [feature] = await ctx.db
                .select()
                .from(features)
                .where(and(eq(features.id, input.featureId), eq(features.organizationId, input.organizationId)))
                .limit(1);
            if (!feature) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });

            const [entitlement] = await ctx.db
                .insert(entitlements)
                .values({
                    customerId: input.customerId,
                    featureId: input.featureId,
                    value: input.value,
                })
                .returning();
            return entitlement;
        }),

    update: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                id: z.string(),
                value: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            // Step 1: Verify entitlement belongs to org via customer join
            const [entitlement] = await ctx.db
                .select({ id: entitlements.id })
                .from(entitlements)
                .innerJoin(customers, eq(customers.id, entitlements.customerId))
                .where(
                    and(
                        eq(entitlements.id, input.id),
                        eq(customers.organizationId, input.organizationId),
                    ),
                )
                .limit(1);

            if (!entitlement) throw new TRPCError({ code: "NOT_FOUND", message: "Entitlement not found" });

            // Step 2: Update entitlement by id only (safe because verified above)
            const [updatedEntitlement] = await ctx.db
                .update(entitlements)
                .set({ value: input.value, updatedAt: new Date() })
                .where(eq(entitlements.id, input.id))
                .returning();

            return updatedEntitlement;
        }),

    delete: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // Step 1: Verify entitlement belongs to org
            const [entitlement] = await ctx.db
                .select({ id: entitlements.id })
                .from(entitlements)
                .innerJoin(customers, eq(customers.id, entitlements.customerId))
                .where(
                    and(
                        eq(entitlements.id, input.id),
                        eq(customers.organizationId, input.organizationId),
                    ),
                )
                .limit(1);

            if (!entitlement) throw new TRPCError({ code: "NOT_FOUND", message: "Entitlement not found" });

            // Step 2: Delete entitlement by id only
            await ctx.db
                .delete(entitlements)
                .where(eq(entitlements.id, input.id));

            return { success: true };
        }),


    checkFeatureAccess: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), customerId: z.string(), featureSlug: z.string() }))
        .query(async ({ ctx, input }) => {
            return await checkFeatureAccess(ctx.db, input.customerId, input.featureSlug, input.organizationId);
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), customerId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(entitlements)
                .innerJoin(customers, eq(customers.id, entitlements.customerId))
                .where(and(eq(entitlements.customerId, input.customerId), eq(customers.organizationId, input.organizationId)));
        }),
});