import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { pricingPlan, promotion, country, pppRule } from "@/db/schema";

export async function calculatePrice(
  db: any,
  planId: string,
  countryCode: string,
  promotionCode?: string,
  organizationId?: string,
) {
  const [plan] = await db.select().from(pricingPlan).where(eq(pricingPlan.id, planId)).limit(1);
  if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

  let basePrice = plan.price;
  let pppDiscount = 0;
  let promotionDiscount = 0;

  if (countryCode && organizationId) {
    const [countryRecord] = await db.select().from(country).where(eq(country.code, countryCode)).limit(1);
    if (countryRecord) {
      const [pppRuleRecord] = await db
        .select()
        .from(pppRule)
        .where(
          and(
            eq(pppRule.organizationId, organizationId),
            eq(pppRule.isActive, true),
            eq(pppRule.countries, countryCode),
          ),
        )
        .orderBy(pppRule.priority, "desc")
        .limit(1);

      pppDiscount = pppRuleRecord
        ? Math.min(Math.max(pppRuleRecord.minDiscount, countryRecord.discountPercentage || 0), pppRuleRecord.maxDiscount)
        : countryRecord.discountPercentage || 0;
    }
  }

  if (promotionCode && organizationId) {
    const [promotionRecord] = await db
      .select()
      .from(promotion)
      .where(
        and(
          eq(promotion.code, promotionCode),
          eq(promotion.organizationId, organizationId),
          eq(promotion.isActive, true),
          eq(promotion.validFrom, new Date()),
          eq(promotion.validTo, new Date()),
        ),
      )
      .limit(1);

    if (promotionRecord) {
      if (promotionRecord.type === "percentage") {
        promotionDiscount = Math.round((basePrice * promotionRecord.value) / 100);
      } else if (promotionRecord.type === "fixed") {
        promotionDiscount = promotionRecord.value;
      }
    }
  }

  const finalPrice = Math.max(0, basePrice - pppDiscount - promotionDiscount);

  return { basePrice, pppDiscount, promotionDiscount, finalPrice };
}