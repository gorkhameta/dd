import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { subscription, order, customer, integration, analyticsEvent } from "@/db/schema";

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

// Fetch webhook secret from integration table
async function getWebhookSecret(db: any, organizationId: string, provider: string): Promise<string> {
    const [integrationRecord] = await db
        .select({ webhookSecret: integration.webhookSecret })
        .from(integration)
        .where(
            and(
                eq(integration.organizationId, organizationId),
                eq(integration.provider, provider),
                eq(integration.isActive, true),
            ),
        )
        .limit(1);

    if (!integrationRecord?.webhookSecret) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: `No active integration found for provider ${provider}`,
        });
    }

    return integrationRecord.webhookSecret;
}

// Placeholder for webhook signature verification (provider-specific)
async function verifyWebhookSignature(payload: any, signature: string, secret: string): Promise<boolean> {
    // Implement provider-specific signature verification (e.g., Stripe's webhook signature)
    // Example for Stripe: const event = stripe.webhooks.constructEvent(payload, signature, secret);
    return true; // Replace with actual verification logic
}

// Map external plan ID to internal plan ID (using integration.settings)
async function mapExternalPlanToInternal(db: any, organizationId: string, externalPlanId: string): Promise<string | null> {
    const [integrationRecord] = await db
        .select({ settings: integration.settings })
        .from(integration)
        .where(
            and(
                eq(integration.organizationId, organizationId),
                eq(integration.isActive, true),
            ),
        )
        .limit(1);

    const settings = integrationRecord?.settings as IntegrationSettings | undefined;

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
    const [customerRecord] = await db
        .select()
        .from(customer)
        .where(
            and(
                eq(customer.externalId, data.customerId),
                eq(customer.organizationId, organizationId),
            ),
        )
        .limit(1);

    if (!customerRecord) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: `Customer with external ID ${data.customerId} not found in organization ${organizationId}`,
        });
    }

    // Log webhook event to analyticsEvent
    await db.insert(analyticsEvent).values({
        organizationId,
        eventType: `webhook:${eventType}`,
        eventData: { payload: data },
        customerId: customerRecord.id,
        timestamp: new Date(),
    });

    // Handle different webhook events
    switch (eventType) {
        case "invoice.paid": {
            // Update order and subscription status
            const orderConditions = [
                eq(order.customerId, customerRecord.id),
                eq(order.organizationId, organizationId),
                eq(order.status, "pending"),
            ];
            if (data.amount) {
                orderConditions.push(eq(order.finalAmount, data.amount));
            }

            const [orderRecord] = await db
                .select()
                .from(order)
                .where(and(...orderConditions))
                .limit(1);

            if (orderRecord) {
                await db
                    .update(order)
                    .set({
                        status: "completed",
                        updatedAt: new Date(),
                    })
                    .where(eq(order.id, orderRecord.id));

                // Update customer totalSpent and ordersCount
                await db
                    .update(customer)
                    .set({
                        totalSpent: customerRecord.totalSpent + (data.amount || orderRecord.finalAmount),
                        ordersCount: customerRecord.ordersCount + 1,
                        lastOrderAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(customer.id, customerRecord.id));
            }

            if (data.subscriptionId) {
                const [subscriptionRecord] = await db
                    .select()
                    .from(subscription)
                    .where(
                        and(
                            eq(subscription.customerId, customerRecord.id),
                            eq(subscription.organizationId, organizationId),
                            eq(subscription.externalId, data.subscriptionId),
                        ),
                    )
                    .limit(1);

                if (subscriptionRecord) {
                    await db
                        .update(subscription)
                        .set({
                            status: "active",
                            currentPeriodStart: data.periodStart ? new Date(data.periodStart) : subscriptionRecord.currentPeriodStart,
                            currentPeriodEnd: data.periodEnd ? new Date(data.periodEnd) : subscriptionRecord.currentPeriodEnd,
                            updatedAt: new Date(),
                            metadata: data.metadata || subscriptionRecord.metadata,
                        })
                        .where(eq(subscription.id, subscriptionRecord.id));
                }

                return { eventType, status: "success", orderId: orderRecord?.id, subscriptionId: subscriptionRecord?.id };
            }

            return { eventType, status: "success", orderId: orderRecord?.id, subscriptionId: null };
        }

        case "invoice.payment_failed": {
            if (!data.subscriptionId) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Subscription ID required for invoice.payment_failed event",
                });
            }

            const [subscriptionRecord] = await db
                .select()
                .from(subscription)
                .where(
                    and(
                        eq(subscription.customerId, customerRecord.id),
                        eq(subscription.organizationId, organizationId),
                        eq(subscription.externalId, data.subscriptionId),
                    ),
                )
                .limit(1);

            if (subscriptionRecord) {
                await db
                    .update(subscription)
                    .set({
                        status: "past_due",
                        updatedAt: new Date(),
                    })
                    .where(eq(subscription.id, subscriptionRecord.id));
            }

            return { eventType, status: "success", subscriptionId: subscriptionRecord?.id };
        }

        case "subscription.created": {
            const [subscriptionRecord] = data.subscriptionId
                ? await db
                    .select()
                    .from(subscription)
                    .where(
                        and(
                            eq(subscription.customerId, customerRecord.id),
                            eq(subscription.organizationId, organizationId),
                            eq(subscription.externalId, data.subscriptionId),
                        ),
                    )
                    .limit(1)
                : [];

            const internalPlanId = data.planId ? await mapExternalPlanToInternal(db, organizationId, data.planId) : null;

            if (!subscriptionRecord) {
                // Create new subscription
                await db.insert(subscription).values({
                    id: crypto.randomUUID(),
                    organizationId: customerRecord.organizationId,
                    customerId: customerRecord.id,
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

            const [subscriptionRecord] = await db
                .select()
                .from(subscription)
                .where(
                    and(
                        eq(subscription.customerId, customerRecord.id),
                        eq(subscription.organizationId, organizationId),
                        eq(subscription.externalId, data.subscriptionId),
                    ),
                )
                .limit(1);

            if (!subscriptionRecord) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `Subscription with external ID ${data.subscriptionId} not found`,
                });
            }

            const internalPlanId = data.planId ? await mapExternalPlanToInternal(db, organizationId, data.planId) : subscriptionRecord.planId;

            await db
                .update(subscription)
                .set({
                    planId: internalPlanId,
                    status: data.status || subscriptionRecord.status,
                    currentPeriodStart: data.periodStart ? new Date(data.periodStart) : subscriptionRecord.currentPeriodStart,
                    currentPeriodEnd: data.periodEnd ? new Date(data.periodEnd) : subscriptionRecord.currentPeriodEnd,
                    cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? subscriptionRecord.cancelAtPeriodEnd,
                    metadata: data.metadata || subscriptionRecord.metadata,
                    updatedAt: new Date(),
                })
                .where(eq(subscription.id, subscriptionRecord.id));

            return { eventType, status: "success", subscriptionId: subscriptionRecord.id };
        }

        case "subscription.cancelled": {
            if (!data.subscriptionId) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Subscription ID required for subscription.cancelled event",
                });
            }

            const [subscriptionRecord] = await db
                .select()
                .from(subscription)
                .where(
                    and(
                        eq(subscription.customerId, customerRecord.id),
                        eq(subscription.organizationId, organizationId),
                        eq(subscription.externalId, data.subscriptionId),
                    ),
                )
                .limit(1);

            if (!subscriptionRecord) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `Subscription with external ID ${data.subscriptionId} not found`,
                });
            }

            await db
                .update(subscription)
                .set({
                    status: "cancelled",
                    cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
                    cancelledAt: data.cancelAtPeriodEnd ? null : new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(subscription.id, subscriptionRecord.id));

            return { eventType, status: "success", subscriptionId: subscriptionRecord.id };
        }

        case "subscription.trial_ended": {
            if (!data.subscriptionId) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Subscription ID required for subscription.trial_ended event",
                });
            }

            const [subscriptionRecord] = await db
                .select()
                .from(subscription)
                .where(
                    and(
                        eq(subscription.customerId, customerRecord.id),
                        eq(subscription.organizationId, organizationId),
                        eq(subscription.externalId, data.subscriptionId),
                    ),
                )
                .limit(1);

            if (!subscriptionRecord) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `Subscription with external ID ${data.subscriptionId} not found`,
                });
            }

            await db
                .update(subscription)
                .set({
                    status: "active",
                    trialEnd: null,
                    updatedAt: new Date(),
                })
                .where(eq(subscription.id, subscriptionRecord.id));

            return { eventType, status: "success", subscriptionId: subscriptionRecord.id };
        }

        default:
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Unsupported webhook event type: ${eventType}`,
            });
    }
}