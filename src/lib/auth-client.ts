/**
 * Após `signIn()` com `redirect: false`, o cookie de sessão pode não estar
 * imediatamente visível para a próxima navegação (race comum em dev). Faz
 * polling curto em `/api/auth/session` até confirmar a sessão antes de
 * navegar, evitando um bounce de volta para /login.
 */
export async function waitForSession(maxAttempts = 12, delayMs = 150): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const session = await res.json();
      if (session?.user) return true;
    } catch {
      // ignore and retry
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}
