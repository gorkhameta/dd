import {
    pgTable,
    text,
    integer,
    real,
    boolean,
    timestamp,
    json,
    index,
    uniqueIndex,
    pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
// Enums for status, role, and feature type fields
export const orderStatusEnum = pgEnum("order_status", ["pending", "completed", "failed", "refunded", "cancelled"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "cancelled", "past_due", "unpaid", "trialing"]);
export const promotionTypeEnum = pgEnum("promotion_type", ["percentage", "fixed", "free_trial"]);
export const userRoleEnum = pgEnum("user_role", ["admin", "user", "member"]);
export const featureTypeEnum = pgEnum("feature_type", ["boolean", "numeric", "text"]);

// Country table: Stores PPP and currency data (moved before customer since it's referenced)
export const country = pgTable("country", {
    code: text("code").primaryKey(), // ISO 3166-1 alpha-2
    name: text("name").notNull(),
    pppFactor: real("ppp_factor").notNull().default(1.0),
    discountPercentage: integer("discount_percentage").default(0),
    currency: text("currency").notNull().default("USD"),
    isActive: boolean("is_active").default(true),
    updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
    nameIdx: index("country_name_idx").on(table.name),
    activeIdx: index("country_active_idx").on(table.isActive),
}));

// User table: Represents a registered user with role
export const user = pgTable("user", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    lastName: text("last_name"),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: userRoleEnum("role").notNull().default("user"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    emailIdx: uniqueIndex("user_email_idx").on(table.email),
    roleIdx: index("user_role_idx").on(table.role),
}));

// Session table: Tracks user session
export const session = pgTable("session", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => ({
    tokenIdx: uniqueIndex("session_token_idx").on(table.token),
    userIdIdx: index("session_user_id_idx").on(table.userId),
}));

// Account table: Stores external provider account
export const account = pgTable("account", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    userIdIdx: index("account_user_id_idx").on(table.userId),
    providerAccountIdx: uniqueIndex("account_provider_account_idx").on(table.providerId, table.accountId),
}));

// Verification table: Manages email verification
export const verification = pgTable("verification", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    identifierIdx: index("verification_identifier_idx").on(table.identifier),
}));

// Organization table: Represents a business or team
export const organization = pgTable("organization", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    size: text("size").notNull(), // Organization size
    howHeard: text("how_heard").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({

}));

// Member table: Tracks organization member
export const member = pgTable("member", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    orgUserIdx: uniqueIndex("member_org_user_idx").on(table.organizationId, table.userId),
    organizationIdIdx: index("member_organization_id_idx").on(table.organizationId),
    userIdIdx: index("member_user_id_idx").on(table.userId),
}));

// Invitation table: Manages organization invitation
export const invitation = pgTable("invitation", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("pending"),
    inviterId: text("inviter_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("invitation_organization_id_idx").on(table.organizationId),
    emailIdx: index("invitation_email_idx").on(table.email),
}));

// Feature table: Represents feature with slug, type, and metadata
export const feature = pgTable("feature", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    type: featureTypeEnum("type").notNull().default("boolean"),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    organizationIdIdx: index("feature_organization_id_idx").on(table.organizationId),
    slugIdx: uniqueIndex("feature_slug_idx").on(table.slug),
}));

// Product table: Represents product
export const product = pgTable("product", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    basePrice: integer("base_price").notNull(),
    currency: text("currency").notNull().default("USD"),
    category: text("category"),
    status: text("status").notNull().default("active"),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("product_organization_id_idx").on(table.organizationId),
    statusIdx: index("product_status_idx").on(table.status),
}));

// PricingPlan table: Represents subscription plan
export const pricingPlan = pgTable("pricing_plan", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    productId: text("product_id").notNull().references(() => product.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    price: integer("price").notNull(),
    currency: text("currency").notNull().default("USD"),
    interval: text("interval").notNull(),
    intervalCount: integer("interval_count").default(1),
    trialDays: integer("trial_days").default(0),
    isPopular: boolean("is_popular").default(false),
    sortOrder: integer("sort_order").default(0),
    status: text("status").notNull().default("active"),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    productIdIdx: index("pricing_plan_product_id_idx").on(table.productId),
    statusIdx: index("pricing_plan_status_idx").on(table.status),
}));

// PlanFeature table: Junction table for PricingPlan-Feature relationship
export const planFeature = pgTable("plan_feature", {
    planId: text("plan_id").notNull().references(() => pricingPlan.id, { onDelete: "cascade" }),
    featureId: text("feature_id").notNull().references(() => feature.id, { onDelete: "cascade" }),
    value: json("value"), // Stores feature value/limit
}, (table) => ({
    pk: uniqueIndex("plan_feature_pk").on(table.planId, table.featureId),
}));

// PPPRule table: Defines PPP discount rule
export const pppRule = pgTable("ppp_rule", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    countries: json("countries").notNull(),
    minDiscount: integer("min_discount").default(0),
    maxDiscount: integer("max_discount").default(100),
    isActive: boolean("is_active").default(true),
    priority: integer("priority").default(0),
    conditions: json("conditions"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("ppp_rule_organization_id_idx").on(table.organizationId),
    activeIdx: index("ppp_rule_active_idx").on(table.isActive),
    priorityIdx: index("ppp_rule_priority_idx").on(table.priority),
}));

// Customer table: Represents customer
export const customer = pgTable("customer", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    externalId: text("external_id").unique(), // Add this field
    name: text("name"),
    countryCode: text("country_code").notNull().references(() => country.code, { onDelete: "restrict" }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    totalSpent: integer("total_spent").default(0),
    ordersCount: integer("orders_count").default(0),
    lastOrderAt: timestamp("last_order_at"),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("customer_organization_id_idx").on(table.organizationId),
    emailIdx: index("customer_email_idx").on(table.email),
    countryIdx: index("customer_country_idx").on(table.countryCode),
    orgEmailIdx: uniqueIndex("customer_org_email_idx").on(table.organizationId, table.email),
    externalIdIdx: uniqueIndex("customer_external_id_idx").on(table.externalId), // Add index
}));

// Entitlement table: Tracks customer feature override
export const entitlement = pgTable("entitlement", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    customerId: text("customer_id").notNull().references(() => customer.id, { onDelete: "cascade" }),
    featureId: text("feature_id").notNull().references(() => feature.id, { onDelete: "cascade" }),
    value: json("value"), // Stores override value (e.g., true for boolean, number for numeric)
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    customerFeatureIdx: uniqueIndex("entitlement_customer_feature_idx").on(table.customerId, table.featureId),
    customerIdIdx: index("entitlement_customer_id_idx").on(table.customerId),
    featureIdIdx: index("entitlement_feature_id_idx").on(table.featureId),
}));

// Order table: Tracks customer order
export const order = pgTable("order", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull().references(() => customer.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => product.id, { onDelete: "cascade" }),
    planId: text("plan_id").references(() => pricingPlan.id, { onDelete: "set null" }),
    status: orderStatusEnum("status").notNull().default("pending"),
    baseAmount: integer("base_amount").notNull(),
    discountAmount: integer("discount_amount").default(0),
    finalAmount: integer("final_amount").notNull(),
    currency: text("currency").notNull().default("USD"),
    countryCode: text("country_code").notNull().references(() => country.code, { onDelete: "restrict" }),
    pppDiscount: integer("ppp_discount").default(0),
    promotionCode: text("promotion_code"),
    promotionDiscount: integer("promotion_discount").default(0),
    paymentMethod: text("payment_method"),
    paymentId: text("payment_id"),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("order_organization_id_idx").on(table.organizationId),
    customerIdIdx: index("order_customer_id_idx").on(table.customerId),
    planIdIdx: index("order_plan_id_idx").on(table.planId),
    statusIdx: index("order_status_idx").on(table.status),
    createdAtIdx: index("order_created_at_idx").on(table.createdAt),
    countryIdx: index("order_country_idx").on(table.countryCode),
}));

// Promotion table: Manages promotional campaign
export const promotion = pgTable("promotion", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    code: text("code").notNull().unique(),
    type: promotionTypeEnum("type").notNull(),
    value: integer("value").notNull(),
    minOrderValue: integer("min_order_value").default(0),
    maxUses: integer("max_uses"),
    currentUses: integer("current_uses").default(0),
    maxUsesPerCustomer: integer("max_uses_per_customer").default(1),
    isActive: boolean("is_active").default(true),
    validFrom: timestamp("valid_from").notNull(),
    validTo: timestamp("valid_to"),
    applicableProducts: json("applicable_products"),
    applicableCountries: json("applicable_countries"),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("promotion_organization_id_idx").on(table.organizationId),
    codeIdx: uniqueIndex("promotion_code_idx").on(table.code),
    activeIdx: index("promotion_active_idx").on(table.isActive),
    validFromIdx: index("promotion_valid_from_idx").on(table.validFrom),
}));

// PromotionUsage table: Tracks promotion usage
export const promotionUsage = pgTable("promotion_usage", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    promotionId: text("promotion_id").notNull().references(() => promotion.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull().references(() => customer.id, { onDelete: "cascade" }),
    orderId: text("order_id").notNull().references(() => order.id, { onDelete: "cascade" }),
    usedAt: timestamp("used_at").notNull().defaultNow(),
}, (table) => ({
    promotionIdIdx: index("promotion_usage_promotion_id_idx").on(table.promotionId),
    customerIdIdx: index("promotion_usage_customer_id_idx").on(table.customerId),
    promotionCustomerOrderIdx: uniqueIndex("promotion_usage_promotion_customer_order_idx").on(table.promotionId, table.customerId, table.orderId),
}));

// PricingTable table: Groups plan for display
export const pricingTable = pgTable("pricing_table", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    theme: json("theme"),
    settings: json("settings"),
    isActive: boolean("is_active").default(true),
    embedCode: text("embed_code"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("pricing_table_organization_id_idx").on(table.organizationId),
    activeIdx: index("pricing_table_active_idx").on(table.isActive),
}));

// PricingTablePlan table: Junction table for PricingTable-PricingPlan relationship
export const pricingTablePlan = pgTable("pricing_table_plan", {
    pricingTableId: text("pricing_table_id").notNull().references(() => pricingTable.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull().references(() => pricingPlan.id, { onDelete: "cascade" }),
}, (table) => ({
    pk: uniqueIndex("pricing_table_plan_pk").on(table.pricingTableId, table.planId),
}));

// Integration table: Stores payment platform credential
export const integration = pgTable("integration", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").default(false),
    credentials: json("credentials").notNull(), // Must be encrypted
    webhookUrl: text("webhook_url"),
    webhookSecret: text("webhook_secret"),
    settings: json("settings"),
    lastSyncAt: timestamp("last_sync_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("integration_organization_id_idx").on(table.organizationId),
    providerIdx: index("integration_provider_idx").on(table.provider),
    activeIdx: index("integration_active_idx").on(table.isActive),
    orgProviderIdx: uniqueIndex("integration_org_provider_idx").on(table.organizationId, table.provider),
}));

// Subscription table: Tracks customer subscription
export const subscription = pgTable("subscription", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull().references(() => customer.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull().references(() => pricingPlan.id, { onDelete: "cascade" }),
    status: subscriptionStatusEnum("status").notNull(),
    currentPeriodStart: timestamp("current_period_start").notNull(),
    currentPeriodEnd: timestamp("current_period_end").notNull(),
    trialStart: timestamp("trial_start"),
    trialEnd: timestamp("trial_end"),
    cancelledAt: timestamp("cancelled_at"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
    externalId: text("external_id").unique(),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("subscription_organization_id_idx").on(table.organizationId),
    customerIdIdx: index("subscription_customer_id_idx").on(table.customerId),
    planIdIdx: index("subscription_plan_id_idx").on(table.planId),
    statusIdx: index("subscription_status_idx").on(table.status),
    externalIdIdx: uniqueIndex("subscription_external_id_idx").on(table.externalId),
}));

// AnalyticsEvent table: Tracks analytics data
export const analyticsEvent = pgTable("analytics_event", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    eventData: json("event_data"),
    customerId: text("customer_id").references(() => customer.id, { onDelete: "set null" }),
    productId: text("product_id").references(() => product.id, { onDelete: "set null" }),
    orderId: text("order_id").references(() => order.id, { onDelete: "set null" }),
    countryCode: text("country_code"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("analytics_event_organization_id_idx").on(table.organizationId),
    eventTypeIdx: index("analytics_event_event_type_idx").on(table.eventType),
    timestampIdx: index("analytics_event_timestamp_idx").on(table.timestamp),
    countryIdx: index("analytics_event_country_idx").on(table.countryCode),
}));

// APIKey table: Manages API key
export const apiKey = pgTable("api_key", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    permissions: json("permissions").notNull(),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("api_key_organization_id_idx").on(table.organizationId),
    keyHashIdx: uniqueIndex("api_key_key_hash_idx").on(table.keyHash),
    activeIdx: index("api_key_active_idx").on(table.isActive),
}));

// Relations
export const userRelations = relations(user, ({ many }) => ({
    session: many(session),
    account: many(account),
    member: many(member),
    invitation: many(invitation),
}));

export const sessionRelations = relations(session, ({ one }) => ({
    user: one(user, {
        fields: [session.userId],
        references: [user.id],
    }),
}));

export const accountRelations = relations(account, ({ one }) => ({
    user: one(user, {
        fields: [account.userId],
        references: [user.id],
    }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
    member: many(member),
    invitation: many(invitation),
    feature: many(feature),
    product: many(product),
    pppRule: many(pppRule),
    customer: many(customer),
    order: many(order),
    promotion: many(promotion),
    pricingTable: many(pricingTable),
    integration: many(integration),
    subscription: many(subscription),
    analyticsEvent: many(analyticsEvent),
    apiKey: many(apiKey),
}));

export const memberRelations = relations(member, ({ one }) => ({
    organization: one(organization, {
        fields: [member.organizationId],
        references: [organization.id],
    }),
    user: one(user, {
        fields: [member.userId],
        references: [user.id],
    }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
    organization: one(organization, {
        fields: [invitation.organizationId],
        references: [organization.id],
    }),
    inviter: one(user, {
        fields: [invitation.inviterId],
        references: [user.id],
    }),
}));

export const countryRelations = relations(country, ({ many }) => ({
    customer: many(customer),
    order: many(order),
}));

export const featureRelations = relations(feature, ({ one, many }) => ({
    organization: one(organization, {
        fields: [feature.organizationId],
        references: [organization.id],
    }),
    planFeature: many(planFeature),
    entitlement: many(entitlement),
}));

export const productRelations = relations(product, ({ one, many }) => ({
    organization: one(organization, {
        fields: [product.organizationId],
        references: [organization.id],
    }),
    pricingPlan: many(pricingPlan),
    order: many(order),
    analyticsEvent: many(analyticsEvent),
}));

export const pricingPlanRelations = relations(pricingPlan, ({ one, many }) => ({
    product: one(product, {
        fields: [pricingPlan.productId],
        references: [product.id],
    }),
    planFeature: many(planFeature),
    order: many(order),
    subscription: many(subscription),
    pricingTablePlan: many(pricingTablePlan),
}));

export const planFeatureRelations = relations(planFeature, ({ one }) => ({
    plan: one(pricingPlan, {
        fields: [planFeature.planId],
        references: [pricingPlan.id],
    }),
    feature: one(feature, {
        fields: [planFeature.featureId],
        references: [feature.id],
    }),
}));

export const entitlementRelations = relations(entitlement, ({ one }) => ({
    customer: one(customer, {
        fields: [entitlement.customerId],
        references: [customer.id],
    }),
    feature: one(feature, {
        fields: [entitlement.featureId],
        references: [feature.id],
    }),
}));

export const pppRuleRelations = relations(pppRule, ({ one }) => ({
    organization: one(organization, {
        fields: [pppRule.organizationId],
        references: [organization.id],
    }),
}));

export const customerRelations = relations(customer, ({ one, many }) => ({
    organization: one(organization, {
        fields: [customer.organizationId],
        references: [organization.id],
    }),
    country: one(country, {
        fields: [customer.countryCode],
        references: [country.code],
    }),
    order: many(order),
    subscription: many(subscription),
    entitlement: many(entitlement),
    promotionUsage: many(promotionUsage),
    analyticsEvent: many(analyticsEvent),
}));

export const orderRelations = relations(order, ({ one, many }) => ({
    organization: one(organization, {
        fields: [order.organizationId],
        references: [organization.id],
    }),
    customer: one(customer, {
        fields: [order.customerId],
        references: [customer.id],
    }),
    product: one(product, {
        fields: [order.productId],
        references: [product.id],
    }),
    plan: one(pricingPlan, {
        fields: [order.planId],
        references: [pricingPlan.id],
    }),
    country: one(country, {
        fields: [order.countryCode],
        references: [country.code],
    }),
    promotionUsage: many(promotionUsage),
    analyticsEvent: many(analyticsEvent),
}));

export const promotionRelations = relations(promotion, ({ one, many }) => ({
    organization: one(organization, {
        fields: [promotion.organizationId],
        references: [organization.id],
    }),
    promotionUsage: many(promotionUsage),
}));

export const promotionUsageRelations = relations(promotionUsage, ({ one }) => ({
    promotion: one(promotion, {
        fields: [promotionUsage.promotionId],
        references: [promotion.id],
    }),
    customer: one(customer, {
        fields: [promotionUsage.customerId],
        references: [customer.id],
    }),
    order: one(order, {
        fields: [promotionUsage.orderId],
        references: [order.id],
    }),
}));

export const pricingTableRelations = relations(pricingTable, ({ one, many }) => ({
    organization: one(organization, {
        fields: [pricingTable.organizationId],
        references: [organization.id],
    }),
    pricingTablePlan: many(pricingTablePlan),
}));

export const pricingTablePlanRelations = relations(pricingTablePlan, ({ one }) => ({
    pricingTable: one(pricingTable, {
        fields: [pricingTablePlan.pricingTableId],
        references: [pricingTable.id],
    }),
    plan: one(pricingPlan, {
        fields: [pricingTablePlan.planId],
        references: [pricingPlan.id],
    }),
}));

export const integrationRelations = relations(integration, ({ one }) => ({
    organization: one(organization, {
        fields: [integration.organizationId],
        references: [organization.id],
    }),
}));

export const subscriptionRelations = relations(subscription, ({ one }) => ({
    organization: one(organization, {
        fields: [subscription.organizationId],
        references: [organization.id],
    }),
    customer: one(customer, {
        fields: [subscription.customerId],
        references: [customer.id],
    }),
    plan: one(pricingPlan, {
        fields: [subscription.planId],
        references: [pricingPlan.id],
    }),
}));

export const analyticsEventRelations = relations(analyticsEvent, ({ one }) => ({
    organization: one(organization, {
        fields: [analyticsEvent.organizationId],
        references: [organization.id],
    }),
    customer: one(customer, {
        fields: [analyticsEvent.customerId],
        references: [customer.id],
    }),
    product: one(product, {
        fields: [analyticsEvent.productId],
        references: [product.id],
    }),
    order: one(order, {
        fields: [analyticsEvent.orderId],
        references: [order.id],
    }),
}));

export const apiKeyRelations = relations(apiKey, ({ one }) => ({
    organization: one(organization, {
        fields: [apiKey.organizationId],
        references: [organization.id],
    }),
}));

// Export types
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
export type Organization = typeof organization.$inferSelect;
export type NewOrganization = typeof organization.$inferInsert;
export type Member = typeof member.$inferSelect;
export type NewMember = typeof member.$inferInsert;
export type Invitation = typeof invitation.$inferSelect;
export type NewInvitation = typeof invitation.$inferInsert;
export type Feature = typeof feature.$inferSelect;
export type NewFeature = typeof feature.$inferInsert;
export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;
export type PricingPlan = typeof pricingPlan.$inferSelect;
export type NewPricingPlan = typeof pricingPlan.$inferInsert;
export type PlanFeature = typeof planFeature.$inferSelect;
export type NewPlanFeature = typeof planFeature.$inferInsert;
export type Country = typeof country.$inferSelect;
export type NewCountry = typeof country.$inferInsert;
export type PPPRule = typeof pppRule.$inferSelect;
export type NewPPPRule = typeof pppRule.$inferInsert;
export type Customer = typeof customer.$inferSelect;
export type NewCustomer = typeof customer.$inferInsert;
export type Entitlement = typeof entitlement.$inferSelect;
export type NewEntitlement = typeof entitlement.$inferInsert;
export type Order = typeof order.$inferSelect;
export type NewOrder = typeof order.$inferInsert;
export type Promotion = typeof promotion.$inferSelect;
export type NewPromotion = typeof promotion.$inferInsert;
export type PromotionUsage = typeof promotionUsage.$inferSelect;
export type NewPromotionUsage = typeof promotionUsage.$inferInsert;
export type PricingTable = typeof pricingTable.$inferSelect;
export type NewPricingTable = typeof pricingTable.$inferInsert;
export type PricingTablePlan = typeof pricingTablePlan.$inferSelect;
export type NewPricingTablePlan = typeof pricingTablePlan.$inferInsert;
export type Integration = typeof integration.$inferSelect;
export type NewIntegration = typeof integration.$inferInsert;
export type Subscription = typeof subscription.$inferSelect;
export type NewSubscription = typeof subscription.$inferInsert;
export type AnalyticsEvent = typeof analyticsEvent.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvent.$inferInsert;
export type APIKey = typeof apiKey.$inferSelect;
export type NewAPIKey = typeof apiKey.$inferInsert;