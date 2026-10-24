// Shared by the demo seed / cleanup scripts. Connects ONLY to a local, dev-looking database.
import mongoose from "mongoose";

export const DEMO_BATCH = "tenants-ui-redesign";

export async function connectLocalOnly() {
  try { process.loadEnvFile(); } catch { /* no .env */ }
  const uri = (process.env.MONGODB_URI || "").trim().replace(/^["']|["']$/g, "");
  const m = uri.match(/^mongodb:\/\/(?:[^@/]*@)?([^/:,?]+)(?::\d+)?\/([^?]*)/);
  const host = m?.[1] ?? "", dbName = m?.[2] ?? "";
  const ok = !uri.startsWith("mongodb+srv://") && ["127.0.0.1", "localhost", "::1"].includes(host) && /(demo|local|test|dev)/i.test(dbName);
  if (!ok) {
    console.error(`REFUSING TO RUN: "${host || "?"}/${dbName}" does not look like a local dev database.`);
    console.error("Allowed: mongodb://localhost or 127.0.0.1 with a database name containing demo|local|test|dev.");
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  return { db: mongoose.connection.db, host, dbName };
}
