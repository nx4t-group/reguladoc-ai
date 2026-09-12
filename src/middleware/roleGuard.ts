// src/middleware/roleGuard.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertCapability } from "@/lib/permissions";
import type { Capability } from "@/lib/permissions";

/**
 * Middleware factory that checks if the current user (from NextAuth session) has the required capability.
 * Usage in an API route:
 *   export default roleGuard(["DOSSIER_CREATE"])(async (req, res) => { ... });
 */
export function roleGuard(requiredCapabilities: Capability[]) {
  return async (handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) => {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      const session = await getServerSession(authOptions);
      if (!session?.user?.role) {
        res.status(401).json({ error: "Autenticação requerida" });
        return;
      }
      const userRole = session.user.role;
      try {
        for (const cap of requiredCapabilities) {
          assertCapability(userRole, cap, `Acesso negado: capacidade ${cap} necessária.`);
        }
        await handler(req, res);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Acesso proibido";
        res.status(403).json({ error: message });
      }
    };
  };
}
