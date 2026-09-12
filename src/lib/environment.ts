export type AppEnvironment = "DEVELOPMENT" | "DEMO" | "PRODUCTION";

export function getAppEnvironment(): AppEnvironment {
  const env = (process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || "").toLowerCase();
  if (env === "demo" || process.env.IS_DEMO === "true" || process.env.NEXT_PUBLIC_IS_DEMO === "true") {
    return "DEMO";
  }
  if (env === "development" || (!env && process.env.NODE_ENV === "development")) {
    return "DEVELOPMENT";
  }
  return "PRODUCTION";
}

export function isDevelopment(): boolean {
  return getAppEnvironment() === "DEVELOPMENT";
}

export function isDemo(): boolean {
  return getAppEnvironment() === "DEMO";
}
