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

// Countries table: Stores PPP and currency data (moved before customers since it's referenced)
export const countries = pgTable("countries", {
    code: text("code").primaryKey(), // ISO 3166-1 alpha-2
    name: text("name").notNull(),
    pppFactor: real("ppp_factor").notNull().default(1.0),
    discountPercentage: integer("discount_percentage").default(0),
    currency: text("currency").notNull().default("USD"),
    isActive: boolean("is_active").default(true),
    updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
    nameIdx: index("countries_name_idx").on(table.name),
    activeIdx: index("countries_active_idx").on(table.isActive),
}));

// User table: Represents a registered user with role
export const users = pgTable("users", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: userRoleEnum("role").notNull().default("user"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    roleIdx: index("users_role_idx").on(table.role),
}));

// Session table: Tracks user sessions
export const sessions = pgTable("sessions", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => ({
    tokenIdx: uniqueIndex("sessions_token_idx").on(table.token),
    userIdIdx: index("sessions_user_id_idx").on(table.userId),
}));

// Account table: Stores external provider accounts
export const accounts = pgTable("accounts", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
    userIdIdx: index("accounts_user_id_idx").on(table.userId),
    providerAccountIdx: uniqueIndex("accounts_provider_account_idx").on(table.providerId, table.accountId),
}));

// Verification table: Manages email verification
export const verifications = pgTable("verifications", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    identifierIdx: index("verifications_identifier_idx").on(table.identifier),
}));

// Organization table: Represents a business or team
export const organizations = pgTable("organizations", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    metadata: json("metadata"),
}, (table) => ({
    slugIdx: uniqueIndex("organizations_slug_idx").on(table.slug),
}));

// Member table: Tracks organization members
export const members = pgTable("members", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    orgUserIdx: uniqueIndex("members_org_user_idx").on(table.organizationId, table.userId),
    organizationIdIdx: index("members_organization_id_idx").on(table.organizationId),
    userIdIdx: index("members_user_id_idx").on(table.userId),
}));

// Invitation table: Manages organization invitations
export const invitations = pgTable("invitations", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("pending"),
    inviterId: text("inviter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("invitations_organization_id_idx").on(table.organizationId),
    emailIdx: index("invitations_email_idx").on(table.email),
}));

// Features table: Represents features with slug, type, and metadata
export const features = pgTable("features", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    type: featureTypeEnum("type").notNull().default("boolean"),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
    organizationIdIdx: index("features_organization_id_idx").on(table.organizationId),
    slugIdx: uniqueIndex("features_slug_idx").on(table.slug),
}));

// Products table: Represents products
export const products = pgTable("products", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
    organizationIdIdx: index("products_organization_id_idx").on(table.organizationId),
    statusIdx: index("products_status_idx").on(table.status),
}));

// PricingPlans table: Represents subscription plans
export const pricingPlans = pgTable("pricing_plans", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
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
    productIdIdx: index("pricing_plans_product_id_idx").on(table.productId),
    statusIdx: index("pricing_plans_status_idx").on(table.status),
}));

// PlanFeatures table: Junction table for PricingPlan-Feature relationship
export const planFeatures = pgTable("plan_features", {
    planId: text("plan_id").notNull().references(() => pricingPlans.id, { onDelete: "cascade" }),
    featureId: text("feature_id").notNull().references(() => features.id, { onDelete: "cascade" }),
    value: json("value"), // Stores feature value/limit
}, (table) => ({
    pk: uniqueIndex("plan_features_pk").on(table.planId, table.featureId),
}));

// PPPRules table: Defines PPP discount rules
export const pppRules = pgTable("ppp_rules", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
    organizationIdIdx: index("ppp_rules_organization_id_idx").on(table.organizationId),
    activeIdx: index("ppp_rules_active_idx").on(table.isActive),
    priorityIdx: index("ppp_rules_priority_idx").on(table.priority),
}));

// Customers table: Represents customers
export const customers = pgTable("customers", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    externalId: text("external_id").unique(), // Add this field
    name: text("name"),
    countryCode: text("country_code").notNull().references(() => countries.code, { onDelete: "restrict" }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    totalSpent: integer("total_spent").default(0),
    ordersCount: integer("orders_count").default(0),
    lastOrderAt: timestamp("last_order_at"),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("customers_organization_id_idx").on(table.organizationId),
    emailIdx: index("customers_email_idx").on(table.email),
    countryIdx: index("customers_country_idx").on(table.countryCode),
    orgEmailIdx: uniqueIndex("customers_org_email_idx").on(table.organizationId, table.email),
    externalIdIdx: uniqueIndex("customers_external_id_idx").on(table.externalId), // Add index
}));

// Entitlements table: Tracks customer feature overrides
export const entitlements = pgTable("entitlements", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    featureId: text("feature_id").notNull().references(() => features.id, { onDelete: "cascade" }),
    value: json("value"), // Stores override value (e.g., true for boolean, number for numeric)
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    customerFeatureIdx: uniqueIndex("entitlements_customer_feature_idx").on(table.customerId, table.featureId),
    customerIdIdx: index("entitlements_customer_id_idx").on(table.customerId),
    featureIdIdx: index("entitlements_feature_id_idx").on(table.featureId),
}));

// Orders table: Tracks customer orders
export const orders = pgTable("orders", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    planId: text("plan_id").references(() => pricingPlans.id, { onDelete: "set null" }),
    status: orderStatusEnum("status").notNull().default("pending"),
    baseAmount: integer("base_amount").notNull(),
    discountAmount: integer("discount_amount").default(0),
    finalAmount: integer("final_amount").notNull(),
    currency: text("currency").notNull().default("USD"),
    countryCode: text("country_code").notNull().references(() => countries.code, { onDelete: "restrict" }),
    pppDiscount: integer("ppp_discount").default(0),
    promotionCode: text("promotion_code"),
    promotionDiscount: integer("promotion_discount").default(0),
    paymentMethod: text("payment_method"),
    paymentId: text("payment_id"),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("orders_organization_id_idx").on(table.organizationId),
    customerIdIdx: index("orders_customer_id_idx").on(table.customerId),
    planIdIdx: index("orders_plan_id_idx").on(table.planId),
    statusIdx: index("orders_status_idx").on(table.status),
    createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
    countryIdx: index("orders_country_idx").on(table.countryCode),
}));

// Promotions table: Manages promotional campaigns
export const promotions = pgTable("promotions", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
    organizationIdIdx: index("promotions_organization_id_idx").on(table.organizationId),
    codeIdx: uniqueIndex("promotions_code_idx").on(table.code),
    activeIdx: index("promotions_active_idx").on(table.isActive),
    validFromIdx: index("promotions_valid_from_idx").on(table.validFrom),
}));

// PromotionUsage table: Tracks promotion usage
export const promotionUsage = pgTable("promotion_usage", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    promotionId: text("promotion_id").notNull().references(() => promotions.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    usedAt: timestamp("used_at").notNull().defaultNow(),
}, (table) => ({
    promotionIdIdx: index("promotion_usage_promotion_id_idx").on(table.promotionId),
    customerIdIdx: index("promotion_usage_customer_id_idx").on(table.customerId),
    promotionCustomerOrderIdx: uniqueIndex("promotion_usage_promotion_customer_order_idx").on(table.promotionId, table.customerId, table.orderId),
}));

// PricingTables table: Groups plans for display
export const pricingTables = pgTable("pricing_tables", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    theme: json("theme"),
    settings: json("settings"),
    isActive: boolean("is_active").default(true),
    embedCode: text("embed_code"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("pricing_tables_organization_id_idx").on(table.organizationId),
    activeIdx: index("pricing_tables_active_idx").on(table.isActive),
}));

// PricingTablePlans table: Junction table for PricingTable-PricingPlan relationship
export const pricingTablePlans = pgTable("pricing_table_plans", {
    pricingTableId: text("pricing_table_id").notNull().references(() => pricingTables.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull().references(() => pricingPlans.id, { onDelete: "cascade" }),
}, (table) => ({
    pk: uniqueIndex("pricing_table_plans_pk").on(table.pricingTableId, table.planId),
}));

// Integrations table: Stores payment platform credentials
export const integrations = pgTable("integrations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
  organizationIdIdx: index("integrations_organization_id_idx").on(table.organizationId),
  providerIdx: index("integrations_provider_idx").on(table.provider),
  activeIdx: index("integrations_active_idx").on(table.isActive),
  orgProviderIdx: uniqueIndex("integrations_org_provider_idx").on(table.organizationId, table.provider),
}));

// Subscriptions table: Tracks customer subscriptions
export const subscriptions = pgTable("subscriptions", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    planId: text("plan_id").notNull().references(() => pricingPlans.id, { onDelete: "cascade" }),
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
    organizationIdIdx: index("subscriptions_organization_id_idx").on(table.organizationId),
    customerIdIdx: index("subscriptions_customer_id_idx").on(table.customerId),
    planIdIdx: index("subscriptions_plan_id_idx").on(table.planId),
    statusIdx: index("subscriptions_status_idx").on(table.status),
    externalIdIdx: uniqueIndex("subscriptions_external_id_idx").on(table.externalId),
}));

// AnalyticsEvents table: Tracks analytics data
export const analyticsEvents = pgTable("analytics_events", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    eventData: json("event_data"),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    countryCode: text("country_code"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("analytics_events_organization_id_idx").on(table.organizationId),
    eventTypeIdx: index("analytics_events_event_type_idx").on(table.eventType),
    timestampIdx: index("analytics_events_timestamp_idx").on(table.timestamp),
    countryIdx: index("analytics_events_country_idx").on(table.countryCode),
}));

// APIKeys table: Manages API keys
export const apiKeys = pgTable("api_keys", {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    permissions: json("permissions").notNull(),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    organizationIdIdx: index("api_keys_organization_id_idx").on(table.organizationId),
    keyHashIdx: uniqueIndex("api_keys_key_hash_idx").on(table.keyHash),
    activeIdx: index("api_keys_active_idx").on(table.isActive),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
    sessions: many(sessions),
    accounts: many(accounts),
    members: many(members),
    invitations: many(invitations),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, {
        fields: [sessions.userId],
        references: [users.id],
    }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
    user: one(users, {
        fields: [accounts.userId],
        references: [users.id],
    }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
    members: many(members),
    invitations: many(invitations),
    features: many(features),
    products: many(products),
    pppRules: many(pppRules),
    customers: many(customers),
    orders: many(orders),
    promotions: many(promotions),
    pricingTables: many(pricingTables),
    integrations: many(integrations),
    subscriptions: many(subscriptions),
    analyticsEvents: many(analyticsEvents),
    apiKeys: many(apiKeys),
}));

export const membersRelations = relations(members, ({ one }) => ({
    organization: one(organizations, {
        fields: [members.organizationId],
        references: [organizations.id],
    }),
    user: one(users, {
        fields: [members.userId],
        references: [users.id],
    }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
    organization: one(organizations, {
        fields: [invitations.organizationId],
        references: [organizations.id],
    }),
    inviter: one(users, {
        fields: [invitations.inviterId],
        references: [users.id],
    }),
}));

export const countriesRelations = relations(countries, ({ many }) => ({
    customers: many(customers),
    orders: many(orders),
}));

export const featuresRelations = relations(features, ({ one, many }) => ({
    organization: one(organizations, {
        fields: [features.organizationId],
        references: [organizations.id],
    }),
    planFeatures: many(planFeatures),
    entitlements: many(entitlements),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
    organization: one(organizations, {
        fields: [products.organizationId],
        references: [organizations.id],
    }),
    pricingPlans: many(pricingPlans),
    orders: many(orders),
    analyticsEvents: many(analyticsEvents),
}));

export const pricingPlansRelations = relations(pricingPlans, ({ one, many }) => ({
    product: one(products, {
        fields: [pricingPlans.productId],
        references: [products.id],
    }),
    planFeatures: many(planFeatures),
    orders: many(orders),
    subscriptions: many(subscriptions),
    pricingTablePlans: many(pricingTablePlans),
}));

export const planFeaturesRelations = relations(planFeatures, ({ one }) => ({
    plan: one(pricingPlans, {
        fields: [planFeatures.planId],
        references: [pricingPlans.id],
    }),
    feature: one(features, {
        fields: [planFeatures.featureId],
        references: [features.id],
    }),
}));

export const entitlementsRelations = relations(entitlements, ({ one }) => ({
    customer: one(customers, {
        fields: [entitlements.customerId],
        references: [customers.id],
    }),
    feature: one(features, {
        fields: [entitlements.featureId],
        references: [features.id],
    }),
}));

export const pppRulesRelations = relations(pppRules, ({ one }) => ({
    organization: one(organizations, {
        fields: [pppRules.organizationId],
        references: [organizations.id],
    }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
    organization: one(organizations, {
        fields: [customers.organizationId],
        references: [organizations.id],
    }),
    country: one(countries, {
        fields: [customers.countryCode],
        references: [countries.code],
    }),
    orders: many(orders),
    subscriptions: many(subscriptions),
    entitlements: many(entitlements),
    promotionUsage: many(promotionUsage),
    analyticsEvents: many(analyticsEvents),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
    organization: one(organizations, {
        fields: [orders.organizationId],
        references: [organizations.id],
    }),
    customer: one(customers, {
        fields: [orders.customerId],
        references: [customers.id],
    }),
    product: one(products, {
        fields: [orders.productId],
        references: [products.id],
    }),
    plan: one(pricingPlans, {
        fields: [orders.planId],
        references: [pricingPlans.id],
    }),
    country: one(countries, {
        fields: [orders.countryCode],
        references: [countries.code],
    }),
    promotionUsage: many(promotionUsage),
    analyticsEvents: many(analyticsEvents),
}));

export const promotionsRelations = relations(promotions, ({ one, many }) => ({
    organization: one(organizations, {
        fields: [promotions.organizationId],
        references: [organizations.id],
    }),
    promotionUsage: many(promotionUsage),
}));

export const promotionUsageRelations = relations(promotionUsage, ({ one }) => ({
    promotion: one(promotions, {
        fields: [promotionUsage.promotionId],
        references: [promotions.id],
    }),
    customer: one(customers, {
        fields: [promotionUsage.customerId],
        references: [customers.id],
    }),
    order: one(orders, {
        fields: [promotionUsage.orderId],
        references: [orders.id],
    }),
}));

export const pricingTablesRelations = relations(pricingTables, ({ one, many }) => ({
    organization: one(organizations, {
        fields: [pricingTables.organizationId],
        references: [organizations.id],
    }),
    pricingTablePlans: many(pricingTablePlans),
}));

export const pricingTablePlansRelations = relations(pricingTablePlans, ({ one }) => ({
    pricingTable: one(pricingTables, {
        fields: [pricingTablePlans.pricingTableId],
        references: [pricingTables.id],
    }),
    plan: one(pricingPlans, {
        fields: [pricingTablePlans.planId],
        references: [pricingPlans.id],
    }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
    organization: one(organizations, {
        fields: [integrations.organizationId],
        references: [organizations.id],
    }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
    organization: one(organizations, {
        fields: [subscriptions.organizationId],
        references: [organizations.id],
    }),
    customer: one(customers, {
        fields: [subscriptions.customerId],
        references: [customers.id],
    }),
    plan: one(pricingPlans, {
        fields: [subscriptions.planId],
        references: [pricingPlans.id],
    }),
}));

export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
    organization: one(organizations, {
        fields: [analyticsEvents.organizationId],
        references: [organizations.id],
    }),
    customer: one(customers, {
        fields: [analyticsEvents.customerId],
        references: [customers.id],
    }),
    product: one(products, {
        fields: [analyticsEvents.productId],
        references: [products.id],
    }),
    order: one(orders, {
        fields: [analyticsEvents.orderId],
        references: [orders.id],
    }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
    organization: one(organizations, {
        fields: [apiKeys.organizationId],
        references: [organizations.id],
    }),
}));

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type Feature = typeof features.$inferSelect;
export type NewFeature = typeof features.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type PricingPlan = typeof pricingPlans.$inferSelect;
export type NewPricingPlan = typeof pricingPlans.$inferInsert;
export type PlanFeature = typeof planFeatures.$inferSelect;
export type NewPlanFeature = typeof planFeatures.$inferInsert;
export type Country = typeof countries.$inferSelect;
export type NewCountry = typeof countries.$inferInsert;
export type PPPRule = typeof pppRules.$inferSelect;
export type NewPPPRule = typeof pppRules.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Entitlement = typeof entitlements.$inferSelect;
export type NewEntitlement = typeof entitlements.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Promotion = typeof promotions.$inferSelect;
export type NewPromotion = typeof promotions.$inferInsert;
export type PromotionUsage = typeof promotionUsage.$inferSelect;
export type NewPromotionUsage = typeof promotionUsage.$inferInsert;
export type PricingTable = typeof pricingTables.$inferSelect;
export type NewPricingTable = typeof pricingTables.$inferInsert;
export type PricingTablePlan = typeof pricingTablePlans.$inferSelect;
export type NewPricingTablePlan = typeof pricingTablePlans.$inferInsert;
export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;
export type APIKey = typeof apiKeys.$inferSelect;
export type NewAPIKey = typeof apiKeys.$inferInsert;