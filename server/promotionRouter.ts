import { products, promotions } from "@/db";
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
                    const [product] = await ctx.db
                        .select()
                        .from(products)
                        .where(and(eq(products.id, productId), eq(products.organizationId, input.organizationId)))
                        .limit(1);
                    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: `Product ${productId} not found` });
                }
            }

            const [promotion] = await ctx.db.insert(promotions).values(input).returning();
            return promotion;
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
                    const [product] = await ctx.db
                        .select()
                        .from(products)
                        .where(and(eq(products.id, productId), eq(products.organizationId, input.organizationId)))
                        .limit(1);
                    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: `Product ${productId} not found` });
                }
            }

            const [promotion] = await ctx.db
                .update(promotions)
                .set({ ...input, updatedAt: new Date() })
                .where(and(eq(promotions.id, input.id), eq(promotions.organizationId, input.organizationId)))
                .returning();

            if (!promotion) throw new TRPCError({ code: "NOT_FOUND", message: "Promotion not found" });

            return promotion;
        }),

    validate: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), code: z.string() }))
        .query(async ({ ctx, input }) => {
            const [promotion] = await ctx.db
                .select()
                .from(promotions)
                .where(
                    and(
                        eq(promotions.organizationId, input.organizationId),
                        eq(promotions.code, input.code),
                        eq(promotions.isActive, true),
                        eq(promotions.validFrom, new Date()),
                        eq(promotions.validTo, new Date()),
                    ),
                )
                .limit(1);

            if (!promotion) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid promotion code" });

            return promotion;
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(promotions)
                .where(eq(promotions.organizationId, input.organizationId));
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .query(async ({ ctx, input }) => {
            const [promotion] = await ctx.db
                .select()
                .from(promotions)
                .where(and(eq(promotions.id, input.id), eq(promotions.organizationId, input.organizationId)))
                .limit(1);

            if (!promotion) throw new TRPCError({ code: "NOT_FOUND", message: "Promotion not found" });

            return promotion;
        }),
});