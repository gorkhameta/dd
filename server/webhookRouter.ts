import { processPaymentWebhook } from "@/logics/paymentService";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import z from "zod";


export const webhookRouter = createTRPCRouter({ 

    handle: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        provider: z.string().default("stripe"),
        payload: z.any(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await processPaymentWebhook(ctx.db, input.payload, input.organizationId, input.provider);
    }),

});