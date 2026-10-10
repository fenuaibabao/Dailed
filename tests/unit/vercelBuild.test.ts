import { describe, expect, test } from "vitest";
import {
  deployKeyType,
  deploymentNameFromKey,
  planBuild,
} from "../../scripts/vercel-build.mjs";

const PROD_KEY = "prod:resilient-crow-586|secret";
const PREVIEW_KEY = "preview:team:project|secret";
const DEV_KEY = "dev:quiet-fox-12|secret";

describe("deploy keys", () => {
  test("reads the key type and deployment name", () => {
    expect(deployKeyType(PROD_KEY)).toBe("prod");
    expect(deployKeyType(PREVIEW_KEY)).toBe("preview");
    expect(deployKeyType(DEV_KEY)).toBe("dev");
    expect(deployKeyType("legacykey")).toBe("prod");
    expect(deployKeyType(undefined)).toBeNull();
    expect(deploymentNameFromKey(PROD_KEY)).toBe("resilient-crow-586");
    expect(deploymentNameFromKey(PREVIEW_KEY)).toBeNull();
  });
});

describe("planBuild", () => {
  test("production deploys Convex, builds, then re-runs the seed without failing the deploy", () => {
    const plan = planBuild({ VERCEL_ENV: "production", CONVEX_DEPLOY_KEY: PROD_KEY });
    expect(plan.steps?.map((s) => s.cmd.join(" "))).toEqual([
      "npx convex deploy --cmd npm run build",
      "npx convex run seed:run",
    ]);
    expect(plan.steps?.[1].optional).toBe(true);
  });

  test("production refuses to run without a production key", () => {
    expect(planBuild({ VERCEL_ENV: "production", CONVEX_DEPLOY_KEY: PREVIEW_KEY }).error).toBeTruthy();
    expect(planBuild({ VERCEL_ENV: "production" }).error).toBeTruthy();
  });

  test("a preview with the production key builds the site only and drops the key", () => {
    const plan = planBuild({ VERCEL_ENV: "preview", CONVEX_DEPLOY_KEY: PROD_KEY });
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps?.[0].cmd.join(" ")).toBe("npm run build");
    expect(plan.steps?.[0].env.CONVEX_DEPLOY_KEY).toBeUndefined();
    expect(plan.steps?.[0].env.NEXT_PUBLIC_CONVEX_URL).toBe("https://resilient-crow-586.convex.cloud");
  });

  test("an explicit NEXT_PUBLIC_CONVEX_URL wins for previews", () => {
    const plan = planBuild({
      VERCEL_ENV: "preview",
      CONVEX_DEPLOY_KEY: PROD_KEY,
      NEXT_PUBLIC_CONVEX_URL: "https://quiet-fox-12.convex.cloud",
    });
    expect(plan.steps?.[0].env.NEXT_PUBLIC_CONVEX_URL).toBe("https://quiet-fox-12.convex.cloud");
  });

  test("previews with a preview or dev key deploy to that deployment", () => {
    for (const key of [PREVIEW_KEY, DEV_KEY]) {
      const plan = planBuild({ VERCEL_ENV: "preview", CONVEX_DEPLOY_KEY: key });
      expect(plan.steps?.map((s) => s.cmd.join(" "))).toEqual(["npx convex deploy --cmd npm run build"]);
    }
  });

  test("a preview with nothing to point at fails with a clear message", () => {
    expect(planBuild({ VERCEL_ENV: "preview" }).error).toMatch(/NEXT_PUBLIC_CONVEX_URL/);
  });
});
