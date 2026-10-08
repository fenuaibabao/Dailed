import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

// Convex Auth signs session JWTs with these. Real deployments get them from
// `npx @convex-dev/auth`; tests make a throwaway pair.
const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
process.env.JWT_PRIVATE_KEY = (await exportPKCS8(privateKey)).trimEnd().replace(/\n/g, " ");
process.env.JWKS = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(publicKey)) }] });
process.env.CONVEX_SITE_URL = "https://test.convex.site";
process.env.SITE_URL = "http://localhost:3000";
