// src/server/trpc/init.ts
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { cache } from 'react';
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { and, eq } from 'drizzle-orm';
import { member } from '@/db/schema';
import { z } from 'zod';
import { db } from '@/db';

// 1. Create context factory function (cached)
export const createTRPCContext = cache(async () => {
  const authSession = await auth.api.getSession({ headers: await headers() });
  return {
    auth: authSession,
    db,
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

// 2. Initialize tRPC with context type and transformer
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

// 3. Middleware: ensure user is authenticated
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.auth?.session?.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({ ctx });
});

// 4. Zod schema for orgId input validation
const orgIdInput = z.object({
  organizationId: z.string().uuid(),
});

// 5. Middleware: require user is a member of org
const requireOrgAccess = t.middleware(async ({ ctx, input, next }) => {



  const parseResult = orgIdInput.safeParse(input);
  if (!parseResult.success) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or missing organizationId' });
  }
  const { organizationId } = parseResult.data;

  const userId = ctx.auth!.session.userId;

  const members = await ctx.db.query.member.findFirst({
    where: and(
      eq(member.userId, userId),
      eq(member.organizationId, organizationId),
    ),
  });

  if (!members) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'User is not a member of this organization' });
  }

  return next({
    ctx: {
      ...ctx,
      members,
    },
  });
});

// 6. Middleware: require user is admin of org
const requireOrgAdmin = t.middleware(async ({ ctx, input, next }) => {
  const parseResult = orgIdInput.safeParse(input);
  if (!parseResult.success) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or missing organizationId' });
  }
  const { organizationId } = parseResult.data;

  const userId = ctx.auth!.session.userId;

  const members = await ctx.db.query.member.findFirst({
    where: and(
      eq(member.userId, userId),
      eq(member.organizationId, organizationId),
      eq(member.role, 'admin'), // adjust if you use enums
    ),
  });

  if (!members) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'User is not an admin of this organization' });
  }

  return next({
    ctx: {
      ...ctx,
      members,
    },
  });
});

// 7. Export base router and procedures with middleware chaining
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = publicProcedure.use(isAuthed);

export const orgAccessProcedure = protectedProcedure.use(requireOrgAccess);

export const orgAdminProcedure = protectedProcedure.use(requireOrgAdmin);
