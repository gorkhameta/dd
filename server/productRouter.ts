import { products } from "@/db";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";


export const productRouter = createTRPCRouter({
    create: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                name: z.string().min(1),
                description: z.string().optional(),
                basePrice: z.number().int().min(0),
                currency: z.string().default("USD"),
                category: z.string().optional(),
                status: z.string().default("active"),
                metadata: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [product] = await ctx.db.insert(products).values(input).returning();
            return product;
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), productId: z.string() }))
        .query(async ({ ctx, input }) => {
            const [product] = await ctx.db
                .select()
                .from(products)
                .where(and(eq(products.id, input.productId), eq(products.organizationId, input.organizationId)))
                .limit(1);

            if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

            return product;
        }),

    update: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                id: z.string(),
                name: z.string().optional(),
                description: z.string().optional(),
                basePrice: z.number().int().min(0).optional(),
                currency: z.string().optional(),
                category: z.string().optional(),
                status: z.string().optional(),
                metadata: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [product] = await ctx.db
                .update(products)
                .set({ ...input, updatedAt: new Date() })
                .where(and(eq(products.id, input.id), eq(products.organizationId, input.organizationId)))
                .returning();

            if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

            return product;
        }),

    delete: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db
                .delete(products)
                .where(and(eq(products.id, input.id), eq(products.organizationId, input.organizationId)));
            return { success: true };
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(products)
                .where(eq(products.organizationId, input.organizationId));
        }),
});