import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { subscriptions, orders, customers, integrations, analyticsEvents } from "@/db";

// Define type for integration settings to ensure safe access to planMapping
type IntegrationSettings = {
    planMapping?: Record<string, string>;
    [key: string]: any;
};

// Define webhook event schema (aligned with your schema and common payment providers)
const WebhookEventSchema = z.object({
    eventType: z.enum([
        "invoice.paid",
        "invoice.payment_failed",
        "subscription.created",
        "subscription.updated",
        "subscription.cancelled",
        "subscription.trial_ended",
    ]),
    data: z.object({
        subscriptionId: z.string().optional(), // External subscription ID from payment provider
        customerId: z.string(), // External customer ID from payment provider
        status: z.enum(["active", "cancelled", "past_due", "unpaid", "trialing"]).optional(),
        amount: z.number().int().min(0).optional(),
        currency: z.string().optional(),
        periodStart: z.string().datetime().optional(),
        periodEnd: z.string().datetime().optional(),
        cancelAtPeriodEnd: z.boolean().optional(),
        trialEnd: z.string().datetime().optional(),
        planId: z.string().optional(), // External plan ID from payment provider
        metadata: z.any().optional(),
    }),
    signature: z.string(), // For webhook signature verification
});

// Fetch webhook secret from integrations table
async function getWebhookSecret(db: any, organizationId: string, provider: string): Promise<string> {
    const [integration] = await db
        .select({ webhookSecret: integrations.webhookSecret })
        .from(integrations)
        .where(
            and(
                eq(integrations.organizationId, organizationId),
                eq(integrations.provider, provider),
                eq(integrations.isActive, true),
            ),
        )
        .limit(1);

    if (!integration?.webhookSecret) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: `No active integration found for provider ${provider}`,
        });
    }

    return integration.webhookSecret;
}

// Placeholder for webhook signature verification (provider-specific)
async function verifyWebhookSignature(payload: any, signature: string, secret: string): Promise<boolean> {
    // Implement provider-specific signature verification (e.g., Stripe's webhook signature)
    // Example for Stripe: const event = stripe.webhooks.constructEvent(payload, signature, secret);
    return true; // Replace with actual verification logic
}

// Map external plan ID to internal plan ID (using integrations.settings)
async function mapExternalPlanToInternal(db: any, organizationId: string, externalPlanId: string): Promise<string | null> {
    const [integration] = await db
        .select({ settings: integrations.settings })
        .from(integrations)
        .where(
            and(
                eq(integrations.organizationId, organizationId),
                eq(integrations.isActive, true),
            ),
        )
        .limit(1);

    const settings = integration?.settings as IntegrationSettings | undefined;

    if (settings?.planMapping?.[externalPlanId]) {
        return settings.planMapping[externalPlanId];
    }

    return null; // Return null if no mapping is found
}

export async function processPaymentWebhook(
    db: any,
    payload: any,
    organizationId: string,
    provider: string = "stripe",
) {
    // Validate payload
    const parsedPayload = WebhookEventSchema.safeParse(payload);
    if (!parsedPayload.success) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid webhook payload",
            cause: parsedPayload.error,
        });
    }

    const { eventType, data, signature } = parsedPayload.data;

    // Fetch and verify webhook secret
    const webhookSecret = await getWebhookSecret(db, organizationId, provider);
    const isValidSignature = await verifyWebhookSignature(payload, signature, webhookSecret);
    if (!isValidSignature) {
        throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid webhook signature",
        });
    }

    // Find customer by external ID
    const [customer] = await db
        .select()
        .from(customers)
        .where(
            and(
                eq(customers.externalId, data.customerId),
                eq(customers.organizationId, organizationId),
            ),
        )
        .limit(1);

    if (!customer) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: `Customer with external ID ${data.customerId} not found in organization ${organizationId}`,
        });
    }

    // Log webhook event to analyticsEvents
    await db.insert(analyticsEvents).values({
        organizationId,
        eventType: `webhook:${eventType}`,
        eventData: { payload: data },
        customerId: customer.id,
        timestamp: new Date(),
    });

    // Handle different webhook events
    switch (eventType) {
        case "invoice.paid": {
            // Update order and subscription status
            const orderConditions = [
                eq(orders.customerId, customer.id),
                eq(orders.organizationId, organizationId),
                eq(orders.status, "pending"),
            ];
            if (data.amount) {
                orderConditions.push(eq(orders.finalAmount, data.amount));
            }

            const [order] = await db
                .select()
                .from(orders)
                .where(and(...orderConditions))
                .limit(1);

            if (order) {
                await db
                    .update(orders)
                    .set({
                        status: "completed",
                        updatedAt: new Date(),
                    })
                    .where(eq(orders.id, order.id));

                // Update customer totalSpent and ordersCount
                await db
                    .update(customers)
                    .set({
                        totalSpent: customer.totalSpent + (data.amount || order.finalAmount),
                        ordersCount: customer.ordersCount + 1,
                        lastOrderAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(customers.id, customer.id));
            }

            if (data.subscriptionId) {
                const [subscription] = await db
                    .select()
                    .from(subscriptions)
                    .where(
                        and(
                            eq(subscriptions.customerId, customer.id),
                            eq(subscriptions.organizationId, organizationId),
                            eq(subscriptions.externalId, data.subscriptionId),
                        ),
                    )
                    .limit(1);

                if (subscription) {
                    await db
                        .update(subscriptions)
                        .set({
                            status: "active",
                            currentPeriodStart: data.periodStart ? new Date(data.periodStart) : subscription.currentPeriodStart,
                            currentPeriodEnd: data.periodEnd ? new Date(data.periodEnd) : subscription.currentPeriodEnd,
                            updatedAt: new Date(),
                            metadata: data.metadata || subscription.metadata,
                        })
                        .where(eq(subscriptions.id, subscription.id));
                }

                return { eventType, status: "success", orderId: order?.id, subscriptionId: subscription?.id };
            }

            return { eventType, status: "success", orderId: order?.id, subscriptionId: null };
        }

        case "invoice.payment_failed": {
            if (!data.subscriptionId) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Subscription ID required for invoice.payment_failed event",
                });
            }

            const [subscription] = await db
                .select()
                .from(subscriptions)
                .where(
                    and(
                        eq(subscriptions.customerId, customer.id),
                        eq(subscriptions.organizationId, organizationId),
                        eq(subscriptions.externalId, data.subscriptionId),
                    ),
                )
                .limit(1);

            if (subscription) {
                await db
                    .update(subscriptions)
                    .set({
                        status: "past_due",
                        updatedAt: new Date(),
                    })
                    .where(eq(subscriptions.id, subscription.id));
            }

            return { eventType, status: "success", subscriptionId: subscription?.id };
        }

        case "subscription.created": {
            const [subscription] = data.subscriptionId
                ? await db
                    .select()
                    .from(subscriptions)
                    .where(
                        and(
                            eq(subscriptions.customerId, customer.id),
                            eq(subscriptions.organizationId, organizationId),
                            eq(subscriptions.externalId, data.subscriptionId),
                        ),
                    )
                    .limit(1)
                : [];

            const internalPlanId = data.planId ? await mapExternalPlanToInternal(db, organizationId, data.planId) : null;

            if (!subscription) {
                // Create new subscription
                await db.insert(subscriptions).values({
                    id: crypto.randomUUID(),
                    organizationId: customer.organizationId,
                    customerId: customer.id,
                    planId: internalPlanId, // May be null if mapping fails
                    externalId: data.subscriptionId || null,
                    status: data.trialEnd ? "trialing" : "active",
                    currentPeriodStart: data.periodStart ? new Date(data.periodStart) : new Date(),
                    currentPeriodEnd: data.periodEnd ? new Date(data.periodEnd) : new Date(),
                    trialStart: data.trialEnd ? new Date() : null,
                    trialEnd: data.trialEnd ? new Date(data.trialEnd) : null,
                    metadata: data.metadata,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }

            return { eventType, status: "success", subscriptionId: data.subscriptionId || null };
        }

        case "subscription.updated": {
            if (!data.subscriptionId) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Subscription ID required for subscription.updated event",
                });
            }

            const [subscription] = await db
                .select()
                .from(subscriptions)
                .where(
                    and(
                        eq(subscriptions.customerId, customer.id),
                        eq(subscriptions.organizationId, organizationId),
                        eq(subscriptions.externalId, data.subscriptionId),
                    ),
                )
                .limit(1);

            if (!subscription) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `Subscription with external ID ${data.subscriptionId} not found`,
                });
            }

            const internalPlanId = data.planId ? await mapExternalPlanToInternal(db, organizationId, data.planId) : subscription.planId;

            await db
                .update(subscriptions)
                .set({
                    planId: internalPlanId,
                    status: data.status || subscription.status,
                    currentPeriodStart: data.periodStart ? new Date(data.periodStart) : subscription.currentPeriodStart,
                    currentPeriodEnd: data.periodEnd ? new Date(data.periodEnd) : subscription.currentPeriodEnd,
                    cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? subscription.cancelAtPeriodEnd,
                    metadata: data.metadata || subscription.metadata,
                    updatedAt: new Date(),
                })
                .where(eq(subscriptions.id, subscription.id));

            return { eventType, status: "success", subscriptionId: subscription.id };
        }

        case "subscription.cancelled": {
            if (!data.subscriptionId) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Subscription ID required for subscription.cancelled event",
                });
            }

            const [subscription] = await db
                .select()
                .from(subscriptions)
                .where(
                    and(
                        eq(subscriptions.customerId, customer.id),
                        eq(subscriptions.organizationId, organizationId),
                        eq(subscriptions.externalId, data.subscriptionId),
                    ),
                )
                .limit(1);

            if (!subscription) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `Subscription with external ID ${data.subscriptionId} not found`,
                });
            }

            await db
                .update(subscriptions)
                .set({
                    status: "cancelled",
                    cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
                    cancelledAt: data.cancelAtPeriodEnd ? null : new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(subscriptions.id, subscription.id));

            return { eventType, status: "success", subscriptionId: subscription.id };
        }

        case "subscription.trial_ended": {
            if (!data.subscriptionId) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Subscription ID required for subscription.trial_ended event",
                });
            }

            const [subscription] = await db
                .select()
                .from(subscriptions)
                .where(
                    and(
                        eq(subscriptions.customerId, customer.id),
                        eq(subscriptions.organizationId, organizationId),
                        eq(subscriptions.externalId, data.subscriptionId),
                    ),
                )
                .limit(1);

            if (!subscription) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `Subscription with external ID ${data.subscriptionId} not found`,
                });
            }

            await db
                .update(subscriptions)
                .set({
                    status: "active",
                    trialEnd: null,
                    updatedAt: new Date(),
                })
                .where(eq(subscriptions.id, subscription.id));

            return { eventType, status: "success", subscriptionId: subscription.id };
        }

        default:
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Unsupported webhook event type: ${eventType}`,
            });
    }
}