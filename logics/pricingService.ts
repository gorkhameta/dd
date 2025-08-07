import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { pricingPlans, promotions, countries, pppRules } from "@/db/schema";

export async function calculatePrice(
  db: any,
  planId: string,
  countryCode: string,
  promotionCode?: string,
  organizationId?: string,
) {
  const [plan] = await db.select().from(pricingPlans).where(eq(pricingPlans.id, planId)).limit(1);
  if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

  let basePrice = plan.price;
  let pppDiscount = 0;
  let promotionDiscount = 0;

  if (countryCode && organizationId) {
    const [country] = await db.select().from(countries).where(eq(countries.code, countryCode)).limit(1);
    if (country) {
      const [pppRule] = await db
        .select()
        .from(pppRules)
        .where(
          and(
            eq(pppRules.organizationId, organizationId),
            eq(pppRules.isActive, true),
            eq(pppRules.countries, countryCode),
          ),
        )
        .orderBy(pppRules.priority, "desc")
        .limit(1);

      pppDiscount = pppRule
        ? Math.min(Math.max(pppRule.minDiscount, country.discountPercentage || 0), pppRule.maxDiscount)
        : country.discountPercentage || 0;
    }
  }

  if (promotionCode && organizationId) {
    const [promotion] = await db
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.code, promotionCode),
          eq(promotions.organizationId, organizationId),
          eq(promotions.isActive, true),
          eq(promotions.validFrom, new Date()),
          eq(promotions.validTo, new Date()),
        ),
      )
      .limit(1);

    if (promotion) {
      if (promotion.type === "percentage") {
        promotionDiscount = Math.round((basePrice * promotion.value) / 100);
      } else if (promotion.type === "fixed") {
        promotionDiscount = promotion.value;
      }
    }
  }

  const finalPrice = Math.max(0, basePrice - pppDiscount - promotionDiscount);

  return { basePrice, pppDiscount, promotionDiscount, finalPrice };
}