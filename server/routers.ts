import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { bookingsRouter } from "./routers/bookings";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(z.object({ password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (!ENV.adminPassword) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "ADMIN_PASSWORD is not configured.",
          });
        }
        if (input.password !== ENV.adminPassword) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid admin password." });
        }

        const cookieOptions = getSessionCookieOptions(ctx.req);
        const token = await sdk.signSession({
          openId: "standalone_admin",
          appId: ENV.appId || "kokomo-lift-booking",
          name: "Kokomo Admin",
        });
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return {
          id: 0,
          openId: "standalone_admin",
          name: "Kokomo Admin",
          email: null,
          loginMethod: "password",
          role: "admin",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  bookings: bookingsRouter,
});

export type AppRouter = typeof appRouter;
