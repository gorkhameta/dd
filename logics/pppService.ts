import { eq, and } from "drizzle-orm";
import { countries, pppRules } from "@/db/schema";

export async function calculatePPPDiscount(db: any, countryCode: string, organizationId: string) {
  const [country] = await db.select().from(countries).where(eq(countries.code, countryCode)).limit(1);
  if (!country) return 0;

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
    .orderBy(pppRules.priority,"desc")
    .limit(1);

  return pppRule
    ? Math.min(Math.max(pppRule.minDiscount, country.discountPercentage || 0), pppRule.maxDiscount)
    : country.discountPercentage || 0;
}

export async function detectCountryFromIP(ipAddress: string): Promise<string> {
  // Implement IP-to-country lookup (e.g., using a GeoIP service)
  return "US"; // Placeholder
}