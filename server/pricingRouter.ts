
import { createTRPCRouter, orgAccessProcedure, } from "@/trpc/init";
import { calculatePrice } from "@/logics/pricingService";
import z from "zod";


export const pricingRouter = createTRPCRouter({

    calculatePrice: orgAccessProcedure
        .input(
            z.object({
                organizationId: z.string(),
                planId: z.string(),
                countryCode: z.string(),
                promotionCode: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            return await calculatePrice(
                ctx.db,
                input.planId,
                input.countryCode,
                input.promotionCode,
                input.organizationId,
            );
        }),
});