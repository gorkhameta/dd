import { country, customer } from "@/db/schema";
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
            const [countryData] = await ctx.db
                .select()
                .from(country)
                .where(eq(country.code, input.countryCode))
                .limit(1);
            if (!countryData) throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });

            const [customerData] = await ctx.db.insert(customer).values(input).returning();
            return customerData;
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
                const [countryData] = await ctx.db
                    .select()
                    .from(country)
                    .where(eq(country.code, input.countryCode))
                    .limit(1);
                if (!countryData) throw new TRPCError({ code: "NOT_FOUND", message: "Country not found" });
            }

            const [customerData] = await ctx.db
                .update(customer)
                .set({ ...input, updatedAt: new Date() })
                .where(and(eq(customer.id, input.id), eq(customer.organizationId, input.organizationId)))
                .returning();

            if (!customerData) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

            return customerData;
        }),

    delete: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db
                .delete(customer)
                .where(and(eq(customer.id, input.id), eq(customer.organizationId, input.organizationId)));
            return { success: true };
        }),

    list: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(customer)
                .where(eq(customer.organizationId, input.organizationId));
        }),

    get: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .query(async ({ ctx, input }) => {
            const [customerData] = await ctx.db
                .select()
                .from(customer)
                .where(and(eq(customer.id, input.id), eq(customer.organizationId, input.organizationId)))
                .limit(1);

            if (!customerData) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });

            return customerData;
        }),
});