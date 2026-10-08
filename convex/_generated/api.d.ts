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
import type * as calls from "../calls.js";
import type * as consents from "../consents.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_llm_index from "../lib/llm/index.js";
import type * as lib_llm_openaiCompatible from "../lib/llm/openaiCompatible.js";
import type * as lib_llm_types from "../lib/llm/types.js";
import type * as lib_ownership from "../lib/ownership.js";
import type * as lib_processing from "../lib/processing.js";
import type * as lib_promptContext from "../lib/promptContext.js";
import type * as lib_remi from "../lib/remi.js";
import type * as lib_secrets from "../lib/secrets.js";
import type * as lib_sessionPrompt from "../lib/sessionPrompt.js";
import type * as outputs from "../outputs.js";
import type * as passwordProvider from "../passwordProvider.js";
import type * as personas from "../personas.js";
import type * as processor from "../processor.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";
import type * as vapiWebhook from "../vapiWebhook.js";

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
  calls: typeof calls;
  consents: typeof consents;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/llm/index": typeof lib_llm_index;
  "lib/llm/openaiCompatible": typeof lib_llm_openaiCompatible;
  "lib/llm/types": typeof lib_llm_types;
  "lib/ownership": typeof lib_ownership;
  "lib/processing": typeof lib_processing;
  "lib/promptContext": typeof lib_promptContext;
  "lib/remi": typeof lib_remi;
  "lib/secrets": typeof lib_secrets;
  "lib/sessionPrompt": typeof lib_sessionPrompt;
  outputs: typeof outputs;
  passwordProvider: typeof passwordProvider;
  personas: typeof personas;
  processor: typeof processor;
  seed: typeof seed;
  users: typeof users;
  vapiWebhook: typeof vapiWebhook;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
