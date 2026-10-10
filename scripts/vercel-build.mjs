// Vercel build command (see vercel.json). Decides what each kind of Vercel
// build is allowed to do to Convex:
//
// - Production builds deploy Convex functions with the production deploy key,
//   build the site, then re-run the idempotent seed so the app and persona rows
//   pick up config changes such as the brand name.
// - Preview builds never touch the production Convex deployment. With a
//   preview or dev deploy key they deploy to that deployment. With only the
//   production key (or no key) they build the site alone, pointed at
//   NEXT_PUBLIC_CONVEX_URL or else the production deployment's URL, and push
//   no backend code. `npx convex deploy` refuses a production key outside
//   production on purpose, which is what used to fail every preview.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEPLOY_AND_BUILD = ["npx", "convex", "deploy", "--cmd", "npm run build"];
const BUILD_ONLY = ["npm", "run", "build"];
const SEED = ["npx", "convex", "run", "seed:run"];

/** "prod" | "preview" | "dev" | other prefix | null when no key. Legacy keys without a prefix are prod. */
export function deployKeyType(key) {
  if (!key) return null;
  const prefix = key.split("|")[0];
  return prefix.includes(":") ? prefix.split(":")[0] : "prod";
}

/** The deployment name inside a deployment key such as "prod:happy-otter-123|...". */
export function deploymentNameFromKey(key) {
  if (!key || !key.includes("|")) return null;
  const parts = key.split("|")[0].split(":");
  return parts.length === 2 && parts[1] ? parts[1] : null;
}

/**
 * Returns the steps to run and the environment for them, or { error }.
 * Pure, so it can be unit tested without spawning anything.
 */
export function planBuild(env) {
  const vercelEnv = env.VERCEL_ENV ?? "development";
  const key = env.CONVEX_DEPLOY_KEY ?? "";
  const keyType = deployKeyType(key);

  if (vercelEnv === "production") {
    if (keyType !== "prod") {
      return {
        error:
          "Production build needs CONVEX_DEPLOY_KEY set to the Convex production deploy key " +
          "(Vercel → Settings → Environment Variables, scoped to Production).",
      };
    }
    return {
      summary: "production: deploy Convex functions, build the site, re-run the seed",
      steps: [
        { cmd: DEPLOY_AND_BUILD, env },
        { cmd: SEED, env, optional: true },
      ],
    };
  }

  if (keyType === "preview" || keyType === "dev") {
    return {
      summary: `${vercelEnv}: deploy to the Convex ${keyType} deployment, then build the site`,
      steps: [{ cmd: DEPLOY_AND_BUILD, env }],
    };
  }

  // Never hand the production key to anything a preview runs.
  const childEnv = { ...env };
  delete childEnv.CONVEX_DEPLOY_KEY;

  let url = env.NEXT_PUBLIC_CONVEX_URL;
  if (!url && keyType === "prod") {
    const name = deploymentNameFromKey(key);
    if (name) url = `https://${name}.convex.cloud`;
  }
  if (!url) {
    return {
      error:
        "Preview build has no Convex backend to point at. Set NEXT_PUBLIC_CONVEX_URL for the " +
        "Preview environment in Vercel, or a Convex dev or preview deploy key as CONVEX_DEPLOY_KEY.",
    };
  }
  childEnv.NEXT_PUBLIC_CONVEX_URL = url;
  return {
    summary: `${vercelEnv}: build the site only, against ${url}; no Convex functions are deployed`,
    steps: [{ cmd: BUILD_ONLY, env: childEnv }],
  };
}

function main() {
  const plan = planBuild(process.env);
  if (plan.error) {
    console.error(`vercel-build: ${plan.error}`);
    process.exit(1);
  }
  console.log(`vercel-build: ${plan.summary}`);
  for (const step of plan.steps) {
    const [command, ...args] = step.cmd;
    const result = spawnSync(command, args, { stdio: "inherit", env: step.env });
    if (result.status === 0) continue;
    if (step.optional) {
      console.warn(`vercel-build: WARNING "${step.cmd.join(" ")}" failed; the deploy continues.`);
      continue;
    }
    process.exit(result.status ?? 1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
