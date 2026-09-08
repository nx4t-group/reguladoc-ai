import type { Role } from "@/lib/constants";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      organizationId: string;
      organizationName: string;
      role: Role;
    };
  }

  interface User {
    organizationId: string;
    organizationName: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    organizationId: string;
    organizationName: string;
    role: Role;
  }
}
