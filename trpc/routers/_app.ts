



import { organizationRouter } from "@/server/organizationRouter";
import { createTRPCRouter } from "../init";
import { memberRouter } from "@/server/memberRouter";
import { invitationRouter } from "@/server/invitationRouter";
import { productRouter } from "@/server/productRouter";
import { planRouter } from "@/server/planRouter";
import { featureRouter } from "@/server/featureRouter";
import { planFeatureRouter } from "@/server/planFeatureRouter";
import { customerRouter } from "@/server/customerRouter";
import { orderRouter } from "@/server/orderRouter";
import { billingRouter } from "@/server/billingRouter";
import { pppRouter } from "@/server/pppRouter";
import { promotionRouter } from "@/server/promotionRouter";
import { pricingRouter } from "@/server/pricingRouter";
import { entitlementRouter } from "@/server/entitlementRouter";
import { analyticsRouter } from "@/server/analyticsRouter";
import { webhookRouter } from "@/server/webhookRouter";
import { integrationRouter } from "@/server/integrationRouter";
import { publicRouter } from "@/server/publicRouter";



export const appRouter = createTRPCRouter({

  organizations: organizationRouter,
  members: memberRouter,
  invitations: invitationRouter,
  products: productRouter,
  plans: planRouter,
  features: featureRouter,
  planFeatures: planFeatureRouter,
  customers: customerRouter,
  orders: orderRouter,
  billings: billingRouter,
  ppp: pppRouter,
  promotions: promotionRouter,
  pricing: pricingRouter,
  entitlements: entitlementRouter,
  analytics: analyticsRouter,
  webhooks: webhookRouter,
  integrations: integrationRouter,
  public: publicRouter,

});
// export type definition of API
export type AppRouter = typeof appRouter;