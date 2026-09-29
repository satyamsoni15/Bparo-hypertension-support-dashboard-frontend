import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { supportFetch, SupportApiError } from "@/lib/api";
import { SUPPORT_ROLES, type AuthUser, type ClinicRef, type SupportRole } from "@/lib/types";

// The support JWT's own `exp` claim (ms), read without verifying: we only use
// it to know when to stop trusting a token the API just handed us.
function accessTokenExpiryMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const exp = (JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function isRole(value: unknown): value is SupportRole {
  return typeof value === "string" && (SUPPORT_ROLES as readonly string[]).includes(value);
}

function clinicsOf(value: unknown): ClinicRef[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is { id: string | number; name?: unknown } => !!c && typeof c === "object" && "id" in c)
    .map((c) => ({ id: c.id, name: typeof c.name === "string" ? c.name : `Clinic #${c.id}` }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Same lifetime as the support API token (8h). The jwt callback below also
  // flags an expired API token, and the proxy then sends the user to /login.
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      // Only an access token the support API has just issued is accepted here.
      // The password check happens in src/lib/actions/auth.ts (loginAction),
      // so its error message (bad password, inactive, rate limited) reaches
      // the form.
      credentials: { accessToken: { label: "Access Token", type: "text" } },
      async authorize(raw) {
        const accessToken = typeof raw?.accessToken === "string" ? raw.accessToken : null;
        if (!accessToken) return null;
        try {
          const me = await supportFetch<AuthUser | { user: AuthUser }>("/auth/me", { token: accessToken });
          const user = "user" in me && me.user ? me.user : (me as AuthUser);
          if (!isRole(user.role)) return null;
          return {
            id: String(user.id),
            email: user.email,
            name: user.name ?? user.email,
            role: user.role,
            clinics: clinicsOf(user.clinics),
            accessToken,
          };
        } catch (err) {
          if (err instanceof SupportApiError) return null;
          throw err;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.clinics = user.clinics;
        token.accessToken = user.accessToken;
        token.accessTokenExpires = accessTokenExpiryMs(user.accessToken) ?? undefined;
        delete token.error;
      } else if (token.accessTokenExpires !== undefined && Date.now() >= token.accessTokenExpires) {
        token.error = "AccessTokenExpired";
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.clinics = token.clinics ?? [];
      session.accessToken = token.accessToken;
      if (token.error) session.error = token.error;
      return session;
    },
  },
});
