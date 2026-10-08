/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as apps from "../apps.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_remi from "../lib/remi.js";
import type * as passwordProvider from "../passwordProvider.js";
import type * as personas from "../personas.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  apps: typeof apps;
  auth: typeof auth;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/remi": typeof lib_remi;
  passwordProvider: typeof passwordProvider;
  personas: typeof personas;
  seed: typeof seed;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
