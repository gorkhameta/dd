
import { invitation, member } from "@/db/schema";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure, protectedProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";
import { customer, entitlement, feature } from "@/db/schema";
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
            const [singleCustomer] = await ctx.db
                .select()
                .from(customer)
                .where(and(eq(customer.id, input.customerId), eq(customer.organizationId, input.organizationId)))
                .limit(1);
            if (!singleCustomer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

            const [singleFeature] = await ctx.db
                .select()
                .from(feature)
                .where(and(eq(feature.id, input.featureId), eq(feature.organizationId, input.organizationId)))
                .limit(1);
            if (!singleFeature) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });

            const [newEntitlement] = await ctx.db
                .insert(entitlement)
                .values({
                    customerId: input.customerId,
                    featureId: input.featureId,
                    value: input.value,
                })
                .returning();
            return newEntitlement;
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
            const [existingEntitlement] = await ctx.db
                .select({ id: entitlement.id })
                .from(entitlement)
                .innerJoin(customer, eq(customer.id, entitlement.customerId))
                .where(
                    and(
                        eq(entitlement.id, input.id),
                        eq(customer.organizationId, input.organizationId),
                    ),
                )
                .limit(1);

            if (!existingEntitlement) throw new TRPCError({ code: "NOT_FOUND", message: "Entitlement not found" });

            // Step 2: Update entitlement by id only (safe because verified above)
            const [updatedEntitlement] = await ctx.db
                .update(entitlement)
                .set({ value: input.value, updatedAt: new Date() })
                .where(eq(entitlement.id, input.id))
                .returning();

            return updatedEntitlement;
        }),

    delete: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // Step 1: Verify entitlement belongs to org
            const [existingEntitlement] = await ctx.db
                .select({ id: entitlement.id })
                .from(entitlement)
                .innerJoin(customer, eq(customer.id, entitlement.customerId))
                .where(
                    and(
                        eq(entitlement.id, input.id),
                        eq(customer.organizationId, input.organizationId),
                    ),
                )
                .limit(1);

            if (!existingEntitlement) throw new TRPCError({ code: "NOT_FOUND", message: "Entitlement not found" });

            // Step 2: Delete entitlement by id only
            await ctx.db
                .delete(entitlement)
                .where(eq(entitlement.id, input.id));

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
                .from(entitlement)
                .innerJoin(customer, eq(customer.id, entitlement.customerId))
                .where(and(eq(entitlement.customerId, input.customerId), eq(customer.organizationId, input.organizationId)));
        }),
});