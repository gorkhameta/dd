import { eq, and } from "drizzle-orm";
import { country, pppRule } from "@/db/schema";

/**
 * Calculates the applicable PPP (Purchasing Power Parity) discount for a given country and organization.
 *
 * Determines the discount percentage based on the country's record and any active PPP rule for the organization and country. If a PPP rule exists, the discount is clamped between the rule's minimum and maximum allowed values. Returns 0 if no country record is found.
 *
 * @param countryCode - The ISO country code to look up
 * @param organizationId - The identifier of the organization for PPP rules
 * @returns The calculated discount percentage for the country and organization
 */
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

/**
 * Returns the country code corresponding to the given IP address.
 *
 * Currently returns "US" as a placeholder value.
 *
 * @param ipAddress - The IP address to look up
 * @returns The detected country code
 */
export async function detectCountryFromIP(ipAddress: string): Promise<string> {
  // Implement IP-to-country lookup (e.g., using a GeoIP service)
  return "US"; // Placeholder
}