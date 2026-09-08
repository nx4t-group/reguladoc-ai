import bcrypt from "bcryptjs";
import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/constants";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const profile = await prisma.profile.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { memberships: { include: { organization: true } } },
        });
        if (!profile) return null;

        const validPassword = await bcrypt.compare(credentials.password, profile.passwordHash);
        if (!validPassword) return null;

        const membership = profile.memberships.find((m) => m.status === "active") ?? profile.memberships[0];
        if (!membership) return null;

        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          image: profile.avatarUrl ?? undefined,
          organizationId: membership.organizationId,
          organizationName: membership.organization.name,
          role: membership.role as Role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.organizationId = token.organizationId as string;
        session.user.organizationName = token.organizationName as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
};
