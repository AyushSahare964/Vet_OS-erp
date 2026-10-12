import dns from "node:dns";
import * as mongooseModule from "mongoose";
import { getCookie } from "@tanstack/react-start/server";
import { verifyRefreshToken } from "./tokens";
import { runWithTenant, type TenantContext } from "./tenantContext";
import { User } from "./models/User";

// Only configure custom DNS servers on Windows local dev to resolve local ISP issues
if (typeof process !== "undefined" && process.platform === "win32" && typeof dns.setServers === "function") {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  } catch {
    // Ignore on non-Windows or restricted environments
  }
}

// Safe CommonJS / ESM default resolution
const mongoose =
  (mongooseModule as unknown as { default?: typeof mongooseModule }).default ||
  mongooseModule;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.__mongooseCache || { conn: null, promise: null };
if (!global.__mongooseCache) {
  global.__mongooseCache = cached;
}

const DEFAULT_MONGODB_URI =
  "mongodb+srv://astroiddistroyer5_db_user:pswR2IXtdysfgrai@cluster0.yvlqwf4.mongodb.net/vetos_erp?retryWrites=true&w=majority&appName=Cluster0";

function getMongoUri(): string {
  if (typeof process !== "undefined" && typeof (process as unknown as { loadEnvFile?: () => void }).loadEnvFile === "function") {
    try {
      (process as unknown as { loadEnvFile: () => void }).loadEnvFile();
    } catch {
      // .env might not exist in some cloud runners or already loaded
    }
  }

  const rawEnv =
    typeof process !== "undefined"
      ? (process.env["MONGODB_URI"] || process.env["VITE_MONGODB_URI"])
      : undefined;

  if (rawEnv && typeof rawEnv === "string") {
    const cleaned = rawEnv.trim().replace(/^["']|["']$/g, "").trim();
    if (cleaned.startsWith("mongodb://") || cleaned.startsWith("mongodb+srv://")) {
      return cleaned;
    }
    console.warn(
      `[MongoDB] Configured MONGODB_URI does not start with "mongodb://" or "mongodb+srv://": "${cleaned.slice(0, 20)}...". Falling back to verified default Atlas URI.`
    );
  }

  return DEFAULT_MONGODB_URI;
}

/**
 * Resolves the current request's tenant from its session cookie. Returns
 * undefined for no cookie / invalid token / user not found — that's
 * required, not a bug: loginFn's initial "find this user by email" lookup
 * happens before we know the tenant, and offline scripts (migrations) have
 * no cookie at all, so both must run unscoped.
 */
async function resolveCurrentTenant(): Promise<TenantContext | undefined> {
  let rawToken: string | undefined;
  try {
    rawToken = getCookie("vetos_refresh");
  } catch {
    return undefined; // not inside a server request (e.g. a migration script)
  }
  if (!rawToken) return undefined;

  try {
    const payload = verifyRefreshToken(rawToken);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await User.findById(payload.sub).select("tenantId roleId").lean() as any;
    if (user?.tenantId) {
      return { tenantId: String(user.tenantId), userId: payload.sub, roleId: String(user.roleId ?? "") };
    }
    return undefined;
  } catch {
    return undefined; // invalid/expired refresh token
  }
}

/**
 * Wraps a server function handler so every Mongoose query it (or anything
 * it calls) makes is transparently scoped to the requesting user's tenant.
 *
 * Why this exists instead of just calling enterWith() inside connectDB():
 * AsyncLocalStorage.enterWith() sets the store for "the rest of the current
 * execution," but in this TanStack Start / Nitro dev setup that guarantee
 * does not survive the return from connectDB() back into the handler's own
 * subsequent awaits — confirmed by direct instrumentation (same storage
 * instance, enterWith called, the very next read already sees undefined).
 * storage.run(ctx, fn), where the actual query awaits happen *inside* fn,
 * reliably works because the whole continuation starts inside run()'s
 * synchronous window rather than crossing back out of it first.
 */
export function tenantScoped<Args extends unknown[], Ret>(
  fn: (...args: Args) => Promise<Ret>,
): (...args: Args) => Promise<Ret> {
  return async (...args: Args): Promise<Ret> => {
    await connectDB();
    const ctx = await resolveCurrentTenant();
    if (ctx) {
      return runWithTenant(ctx, () => fn(...args));
    }
    return fn(...args);
  };
}

export async function connectDB(): Promise<typeof mongoose> {
  // If already connected, return cached connection
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return mongoose;
  }

  // If a connection attempt is already in progress, reuse the existing promise
  if (!cached.promise) {
    const uri = getMongoUri();
    const isWin = typeof process !== "undefined" && process.platform === "win32";
    const opts: mongooseModule.ConnectOptions = {
      maxPoolSize: 15,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
      retryWrites: true,
      ...(isWin ? { family: 4 } : {}),
    };

    cached.promise = (async () => {
      try {
        const m = await mongoose.connect(uri, opts);
        console.log("[MongoDB] Connected to Atlas successfully.");
        cached.conn = m;
        return m;
      } catch (err: any) {
        console.error("[MongoDB] Connection error with primary URI:", err?.message || err);
        // If the environment variable on Vercel fails for ANY reason (invalid scheme, bad auth, network, etc.),
        // auto-recover with verified cluster URI.
        if (uri !== DEFAULT_MONGODB_URI) {
          console.warn("[MongoDB] Primary URI failed. Auto-recovering with verified cluster URI...");
          try {
            const mFallback = await mongoose.connect(DEFAULT_MONGODB_URI, opts);
            console.log("[MongoDB] Recovered and connected to Atlas successfully.");
            cached.conn = mFallback;
            return mFallback;
          } catch (fbErr: any) {
            console.error("[MongoDB] Fallback connection error:", fbErr?.message || fbErr);
            cached.promise = null;
            cached.conn = null;
            throw fbErr;
          }
        }
        cached.promise = null;
        cached.conn = null;
        throw err;
      }
    })();
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    cached.conn = null;
    throw err;
  }

  return cached.conn;
}

export default mongoose;

