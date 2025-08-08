import { country, pppRule } from "@/db/schema";
import { createTRPCRouter, orgAccessProcedure, orgAdminProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { TRPCError } from "@trpc/server";
import { calculatePPPDiscount, detectCountryFromIP } from "@/logics/pppService";

export const pppRouter = createTRPCRouter({
    createRule: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                name: z.string().min(1),
                description: z.string().optional(),
                countries: z.array(z.string()),
                minDiscount: z.number().int().min(0).default(0),
                maxDiscount: z.number().int().min(0).default(100),
                isActive: z.boolean().default(true),
                priority: z.number().int().default(0),
                conditions: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            for (const code of input.countries) {
                const [countryResult] = await ctx.db.select().from(country).where(eq(country.code, code)).limit(1);
                if (!countryResult) throw new TRPCError({ code: "NOT_FOUND", message: `Country ${code} not found` });
            }

            const [rule] = await ctx.db.insert(pppRule).values(input).returning();
            return rule;
        }),

    updateRule: orgAdminProcedure
        .input(
            z.object({
                organizationId: z.string(),
                id: z.string(),
                name: z.string().optional(),
                description: z.string().optional(),
                countries: z.array(z.string()).optional(),
                minDiscount: z.number().int().min(0).optional(),
                maxDiscount: z.number().int().min(0).optional(),
                isActive: z.boolean().optional(),
                priority: z.number().int().optional(),
                conditions: z.any().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            if (input.countries) {
                for (const code of input.countries) {
                    const [countryResult] = await ctx.db.select().from(country).where(eq(country.code, code)).limit(1);
                    if (!countryResult) throw new TRPCError({ code: "NOT_FOUND", message: `Country ${code} not found` });
                }
            }

            const [rule] = await ctx.db
                .update(pppRule)
                .set({ ...input, updatedAt: new Date() })
                .where(and(eq(pppRule.id, input.id), eq(pppRule.organizationId, input.organizationId)))
                .returning();

            if (!rule) throw new TRPCError({ code: "NOT_FOUND", message: "PPP rule not found" });

            return rule;
        }),

    deleteRule: orgAdminProcedure
        .input(z.object({ organizationId: z.string(), id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db
                .delete(pppRule)
                .where(and(eq(pppRule.id, input.id), eq(pppRule.organizationId, input.organizationId)));
            return { success: true };
        }),

    listRules: orgAccessProcedure
        .input(z.object({ organizationId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db
                .select()
                .from(pppRule)
                .where(eq(pppRule.organizationId, input.organizationId));
        }),

    getPPPDiscount: orgAccessProcedure
        .input(z.object({ organizationId: z.string(), countryCode: z.string() }))
        .query(async ({ ctx, input }) => {
            return await calculatePPPDiscount(ctx.db, input.countryCode, input.organizationId);
        }),

    detectCountry: orgAccessProcedure
        .input(z.object({ ipAddress: z.string() }))
        .query(async ({ ctx, input }) => {
            return await detectCountryFromIP(input.ipAddress);
        }),
});
