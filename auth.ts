import { sessionTokenCurrent, revokeSessionToken } from "@/lib/session-revocation";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateMagicToken, authenticatePassword } from "@/lib/login";
import { clientIp } from "@/lib/http";
import { getAuthSecret } from "@/lib/auth-secret";

const asUser = (u: { id: string; email: string; name: string; role: "owner" | "staff" | "superadmin"; tenantId: string | null; tokenVersion: number }) => u;

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: getAuthSecret(),
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/giris" },
  providers: [
    Credentials({
      id: "credentials",
      credentials: { email: {}, password: {} },
      async authorize(creds, request) {
        if (typeof creds?.email !== "string" || typeof creds?.password !== "string") return null;
        const u = await authenticatePassword(creds.email, creds.password, clientIp(request));
        return u ? asUser(u) : null;
      },
    }),
    Credentials({
      id: "magic-link",
      credentials: { token: {} },
      async authorize(creds, request) {
        if (typeof creds?.token !== "string") return null;
        const u = await authenticateMagicToken(creds.token, clientIp(request));
        return u ? asUser(u) : null;
      },
    }),
  ],
  events: {
    async signOut(message) {
      if ("token" in message && message.token) await revokeSessionToken(message.token);
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tokenVersion = user.tokenVersion;
        token.role = user.role;
        token.tenantId = user.tenantId ?? null;
      }
      return await sessionTokenCurrent(token) ? token : null;
    },
    session({ session, token }) {
      session.user.tokenVersion = token.tokenVersion;
      session.user.id = token.userId ?? "";
      session.user.role = token.role ?? "staff";
      session.user.tenantId = token.tenantId ?? null;
      return session;
    },
  },
});
