import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __goatemDbClient: ReturnType<typeof postgres> | undefined;
}

// Reuse the connection across hot reloads in dev, and across warm
// serverless invocations in production, instead of opening a fresh
// connection per request.
const client =
  global.__goatemDbClient ??
  postgres(requireEnv("DATABASE_URL"), {
    // Keep the pool small — this is a low-traffic internal tool, not a
    // public app, and serverless functions each hold their own pool.
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  global.__goatemDbClient = client;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Check .env.local (dev) or the Vercel project's environment variables (prod).`
    );
  }
  return value;
}

export const db = drizzle(client, { schema });
