import { convexAuth } from "@convex-dev/auth/server";
import { DialedPassword } from "./passwordProvider";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [DialedPassword],
});
