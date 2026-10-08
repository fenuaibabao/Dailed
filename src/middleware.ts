import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { AFTER_AUTH_PATH, SIGN_IN_PATH } from "@/lib/routes";

const isAuthPage = createRouteMatcher(["/sign-in", "/sign-up"]);
const isProtectedPage = createRouteMatcher(["/app", "/app/(.*)"]);

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    if (isAuthPage(request) && (await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, AFTER_AUTH_PATH);
    }
    if (isProtectedPage(request) && !(await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, SIGN_IN_PATH);
    }
  },
  // Without a maxAge the auth cookies are session cookies and vanish when the
  // browser closes.
  { cookieConfig: { maxAge: THIRTY_DAYS_IN_SECONDS } },
);

export const config = {
  // Everything except static files and Next internals. /api/auth must stay
  // matched: the middleware proxies sign-in and sign-out through it.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
