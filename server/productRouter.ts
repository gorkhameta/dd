import { product } from "@/db/schema";
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
            const [productResult] = await ctx.db.insert(product).values(input).returning();
            return productResult;
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), productId: z.string() }))
        .query(async ({ ctx, input }) => {
            const [productResult] = await ctx.db
                .select()
                .from(product)
                .where(and(eq(product.id, input.productId), eq(product.organizationId, input.organizationId)))
                .limit(1);

            if (!productResult) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

            return productResult;
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
            const [productResult] = await ctx.db
                .update(product)
                .set({ ...input, updatedAt: new Date() })
                .where(and(eq(product.id, input.id), eq(product.organizationId, input.organizationId)))
                .returning();

            if (!productResult) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });

            return productResult;
        }),

    delete: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db
                .delete(product)
                .where(and(eq(product.id, input.id), eq(product.organizationId, input.organizationId)));
            return { success: true };
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(product)
                .where(eq(product.organizationId, input.organizationId));
        }),
});