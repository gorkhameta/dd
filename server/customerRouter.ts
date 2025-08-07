import { countries, customers } from "@/db";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";

export const customerRouter = createTRPCRouter({
    create: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                email: z.string().email(),
                name: z.string().optional(),
                countryCode: z.string(),
                ipAddress: z.string().optional(),
                userAgent: z.string().optional(),
                metadata: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [country] = await ctx.db
                .select()
                .from(countries)
                .where(eq(countries.code, input.countryCode))
                .limit(1);
            if (!country) throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });

            const [customer] = await ctx.db.insert(customers).values(input).returning();
            return customer;
        }),

    update: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                id: z.string(),
                email: z.string().email().optional(),
                name: z.string().optional(),
                countryCode: z.string().optional(),
                ipAddress: z.string().optional(),
                userAgent: z.string().optional(),
                metadata: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            if (input.countryCode) {
                const [country] = await ctx.db
                    .select()
                    .from(countries)
                    .where(eq(countries.code, input.countryCode))
                    .limit(1);
                if (!country) throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
            }

            const [customer] = await ctx.db
                .update(customers)
                .set({ ...input, updatedAt: new Date() })
                .where(and(eq(customers.id, input.id), eq(customers.organizationId, input.organizationId)))
                .returning();

            if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

            return customer;
        }),

    delete: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db
                .delete(customers)
                .where(and(eq(customers.id, input.id), eq(customers.organizationId, input.organizationId)));
            return { success: true };
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(customers)
                .where(eq(customers.organizationId, input.organizationId));
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .query(async ({ ctx, input }) => {
            const [customer] = await ctx.db
                .select()
                .from(customers)
                .where(and(eq(customers.id, input.id), eq(customers.organizationId, input.organizationId)))
                .limit(1);

            if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

            return customer;
        }),
});