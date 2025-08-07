import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { entitlements, features, subscriptions, planFeatures } from "@/db/schema";

export async function checkFeatureAccess(db: any, customerId: string, featureSlug: string, organizationId: string) {
  const [entitlement] = await db
    .select()
    .from(entitlements)
    .innerJoin(features, eq(features.id, entitlements.featureId))
    .where(
      and(
        eq(entitlements.customerId, customerId),
        eq(features.slug, featureSlug),
        eq(features.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (entitlement) {
    return {
      hasAccess: true,
      limit: entitlement.value?.limit,
      usage: entitlement.value?.usage,
    };
  }

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.customerId, customerId),
        eq(subscriptions.status, "active"),
        eq(subscriptions.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!subscription) return { hasAccess: false };

  const [planFeature] = await db
    .select()
    .from(planFeatures)
    .innerJoin(features, eq(features.id, planFeatures.featureId))
    .where(
      and(
        eq(planFeatures.planId, subscription.planId),
        eq(features.slug, featureSlug),
        eq(features.organizationId, organizationId),
      ),
    )
    .limit(1);

  return {
    hasAccess: !!planFeature,
    limit: planFeature?.value?.limit,
    usage: planFeature?.value?.usage,
  };
}