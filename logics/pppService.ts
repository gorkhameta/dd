import { eq, and } from "drizzle-orm";
import { country, pppRule } from "@/db/schema";

export async function calculatePPPDiscount(db: any, countryCode: string, organizationId: string) {
  const [countryRecord] = await db.select().from(country).where(eq(country.code, countryCode)).limit(1);
  if (!countryRecord) return 0;

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
    .orderBy(pppRule.priority,"desc")
    .limit(1);

  return pppRuleRecord
    ? Math.min(Math.max(pppRuleRecord.minDiscount, countryRecord.discountPercentage || 0), pppRuleRecord.maxDiscount)
    : countryRecord.discountPercentage || 0;
}

export async function detectCountryFromIP(ipAddress: string): Promise<string> {
  // Implement IP-to-country lookup (e.g., using a GeoIP service)
  return "US"; // Placeholder
}