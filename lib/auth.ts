import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { user, session, account, verification, member, invitation } from "@/db/schema";
import { admin, organization } from "better-auth/plugins";

// Define the schema for Better Auth
const schema = {
    user,
    session,
    account,
    verification,
    member,
    invitation,
};

// Configure the Drizzle adapter
const adapter = drizzleAdapter(db, {
    provider: "pg",
    schema,
});

// Initialize Better Auth
export const auth = betterAuth({
    database: adapter,
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
    },
    emailAndPassword: {
        enabled: true,
    },
    plugins: [
        admin(),
        organization({
            teams: {
                enabled: true,
                allowRemovingAllTeams: false,
            },
        }),
    ],
});