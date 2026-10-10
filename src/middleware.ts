import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { getProduct } from "@/config/products";
import { AFTER_AUTH_PATH, SIGN_IN_PATH, withProduct } from "@/lib/routes";

const isAuthPage = createRouteMatcher(["/sign-in", "/sign-up"]);
const isProtectedPage = createRouteMatcher(["/app", "/app/(.*)"]);

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    // Keep the product the user came in through across these redirects.
    const product = getProduct(request.nextUrl.searchParams.get("product"))?.slug;
    if (isAuthPage(request) && (await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, withProduct(AFTER_AUTH_PATH, product));
    }
    if (isProtectedPage(request) && !(await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, withProduct(SIGN_IN_PATH, product));
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
