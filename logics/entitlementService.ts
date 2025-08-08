import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { entitlement, feature, subscription, planFeature } from "@/db/schema";

export async function checkFeatureAccess(db: any, customerId: string, featureSlug: string, organizationId: string) {
  const [entitlementRecord] = await db
    .select()
    .from(entitlement)
    .innerJoin(feature, eq(feature.id, entitlement.featureId))
    .where(
      and(
        eq(entitlement.customerId, customerId),
        eq(feature.slug, featureSlug),
        eq(feature.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (entitlementRecord) {
    return {
      hasAccess: true,
      limit: entitlementRecord.entitlement.value?.limit,
      usage: entitlementRecord.entitlement.value?.usage,
    };
  }

  const [subscriptionRecord] = await db
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.customerId, customerId),
        eq(subscription.status, "active"),
        eq(subscription.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!subscriptionRecord) return { hasAccess: false };

  const [planFeatureRecord] = await db
    .select()
    .from(planFeature)
    .innerJoin(feature, eq(feature.id, planFeature.featureId))
    .where(
      and(
        eq(planFeature.planId, subscriptionRecord.planId),
        eq(feature.slug, featureSlug),
        eq(feature.organizationId, organizationId),
      ),
    )
    .limit(1);

  return {
    hasAccess: !!planFeatureRecord,
    limit: planFeatureRecord?.planFeature.value?.limit,
    usage: planFeatureRecord?.planFeature.value?.usage,
  };
}