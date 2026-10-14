import { ConvexError } from "convex/values";
import { NextRequest } from "next/server";
import { describe, expect, test, vi } from "vitest";
import { AUTH_ERROR, toAuthFormError } from "../../src/lib/authErrors";

// Runs Convex Auth's real Next.js sign-in proxy, with Next and Convex stubbed.
const fetchAction = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("convex/nextjs", () => ({ fetchAction }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ Host: "dailed.vercel.app" }),
  cookies: async () => ({ get: () => undefined }),
}));

// Not in the package's exports, so import the installed file directly. This
// is the file patches/@convex-dev+auth+0.0.96.patch changes.
const { proxyAuthActionToConvex } = await import(
  "../../node_modules/@convex-dev/auth/dist/nextjs/server/proxy.js"
);

function signInRequest() {
  return new NextRequest("https://dailed.vercel.app/api/auth", {
    method: "POST",
    headers: { Host: "dailed.vercel.app", Origin: "https://dailed.vercel.app" },
    body: JSON.stringify({
      action: "auth:signIn",
      args: { provider: "password", params: { flow: "signIn", email: "a@b.co", password: "x" } },
    }),
  });
}

/** What the browser's signIn() throws for a proxied failure. */
async function clientError(response: Response) {
  return new Error(((await response.json()) as { error: string }).error);
}

describe("sign-in proxy", () => {
  test("keeps the error code when production redacts the message", async () => {
    // Production sends only "Server Error" as the message, with the code in data.
    const redacted = Object.assign(new ConvexError(AUTH_ERROR.WRONG_PASSWORD), {
      message: "[Request ID: abc] Server Error",
    });
    fetchAction.mockRejectedValueOnce(redacted);

    const response = await proxyAuthActionToConvex(signInRequest(), {});
    expect(response.status).toBe(400);
    expect(toAuthFormError(await clientError(response))).toMatchObject({
      code: AUTH_ERROR.WRONG_PASSWORD,
      field: "password",
    });
  });

  test("passes development messages through unchanged", async () => {
    const dev = Object.assign(new ConvexError(AUTH_ERROR.NO_ACCOUNT), {
      message: "[Request ID: abc] Server Error\nUncaught ConvexError: DIALED_NO_ACCOUNT",
    });
    fetchAction.mockRejectedValueOnce(dev);

    const error = await clientError(await proxyAuthActionToConvex(signInRequest(), {}));
    expect(error.message).toBe(dev.message);
    expect(toAuthFormError(error).code).toBe(AUTH_ERROR.NO_ACCOUNT);
  });

  test("a real server failure stays a generic error", async () => {
    fetchAction.mockRejectedValueOnce(new Error("[Request ID: abc] Server Error"));

    const error = await clientError(await proxyAuthActionToConvex(signInRequest(), {}));
    expect(toAuthFormError(error).code).toBe("SERVER_ERROR");
  });
});
