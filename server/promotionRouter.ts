import { product, promotion } from "@/db/schema";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";

export const promotionRouter = createTRPCRouter({
    create: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                name: z.string().min(1),
                description: z.string().optional(),
                code: z.string().min(1),
                type: z.enum(["percentage", "fixed", "free_trial"]),
                value: z.number().int().min(0),
                minOrderValue: z.number().int().min(0).default(0),
                maxUses: z.number().int().min(0).optional(),
                maxUsesPerCustomer: z.number().int().min(1).default(1),
                isActive: z.boolean().default(true),
                validFrom: z.date(),
                validTo: z.date().optional(),
                applicableProducts: z.array(z.string()).optional(),
                applicableCountries: z.array(z.string()).optional(),
                metadata: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            if (input.applicableProducts) {
                for (const productId of input.applicableProducts) {
                    const [productResult] = await ctx.db
                        .select()
                        .from(product)
                        .where(and(eq(product.id, productId), eq(product.organizationId, input.organizationId)))
                        .limit(1);
                    if (!productResult) throw new TRPCError({ code: "NOT_FOUND", message: `Product ${productId} not found` });
                }
            }

            const [promotionResult] = await ctx.db.insert(promotion).values(input).returning();
            return promotionResult;
        }),

    update: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                id: z.string(),
                name: z.string().optional(),
                description: z.string().optional(),
                code: z.string().optional(),
                type: z.enum(["percentage", "fixed", "free_trial"]).optional(),
                value: z.number().int().min(0).optional(),
                minOrderValue: z.number().int().min(0).optional(),
                maxUses: z.number().int().min(0).optional(),
                maxUsesPerCustomer: z.number().int().min(1).optional(),
                isActive: z.boolean().optional(),
                validFrom: z.date().optional(),
                validTo: z.date().optional(),
                applicableProducts: z.array(z.string()).optional(),
                applicableCountries: z.array(z.string()).optional(),
                metadata: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            if (input.applicableProducts) {
                for (const productId of input.applicableProducts) {
                    const [productResult] = await ctx.db
                        .select()
                        .from(product)
                        .where(and(eq(product.id, productId), eq(product.organizationId, input.organizationId)))
                        .limit(1);
                    if (!productResult) throw new TRPCError({ code: "NOT_FOUND", message: `Product ${productId} not found` });
                }
            }

            const [promotionResult] = await ctx.db
                .update(promotion)
                .set({ ...input, updatedAt: new Date() })
                .where(and(eq(promotion.id, input.id), eq(promotion.organizationId, input.organizationId)))
                .returning();

            if (!promotionResult) throw new TRPCError({ code: "NOT_FOUND", message: "Promotion not found" });

            return promotionResult;
        }),

    validate: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), code: z.string() }))
        .query(async ({ ctx, input }) => {
            const [promotionResult] = await ctx.db
                .select()
                .from(promotion)
                .where(
                    and(
                        eq(promotion.organizationId, input.organizationId),
                        eq(promotion.code, input.code),
                        eq(promotion.isActive, true),
                        eq(promotion.validFrom, new Date()),
                        eq(promotion.validTo, new Date()),
                    ),
                )
                .limit(1);

            if (!promotionResult) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid promotion code" });

            return promotionResult;
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(promotion)
                .where(eq(promotion.organizationId, input.organizationId));
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .query(async ({ ctx, input }) => {
            const [promotionResult] = await ctx.db
                .select()
                .from(promotion)
                .where(and(eq(promotion.id, input.id), eq(promotion.organizationId, input.organizationId)))
                .limit(1);

            if (!promotionResult) throw new TRPCError({ code: "NOT_FOUND", message: "Promotion not found" });

            return promotionResult;
        }),
});
