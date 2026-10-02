/**
 * Applied to every per-tenant model (via `schema.plugin(tenantScopePlugin)`).
 * Adds a `tenantId` field and transparently scopes every query/write to the
 * tenant in the current request's AsyncLocalStorage context, so business
 * server functions never need to filter by tenant themselves.
 *
 * When no tenant context is set (e.g. the initial email lookup in loginFn,
 * before we know who the user is, or an offline migration script) queries
 * run unscoped — this is intentional, not a bug: it's the only way to
 * resolve *which* tenant a request belongs to in the first place.
 *
 * Hooks are declared with zero parameters (no `next` callback) — the
 * modern Mongoose style where the hook is considered complete when the
 * function returns. Mixing that with a declared `next` parameter is what
 * produces "next is not a function" on this Mongoose version.
 */

import type { Schema } from "mongoose";
import { getTenantContext } from "./tenantContext";

export function tenantScopePlugin(schema: Schema): void {
  if (schema.path("tenantId")) return;
  schema.add({ tenantId: { type: String, index: true } });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pre = schema.pre.bind(schema) as (name: string | RegExp, fn: (this: any) => void) => void;

  pre(/^find/, function () {
    const ctx = getTenantContext();
    if (ctx?.tenantId) this.where({ tenantId: ctx.tenantId });
  });
  pre(/^update/, function () {
    const ctx = getTenantContext();
    if (ctx?.tenantId) this.where({ tenantId: ctx.tenantId });
  });
  pre(/^delete/, function () {
    const ctx = getTenantContext();
    if (ctx?.tenantId) this.where({ tenantId: ctx.tenantId });
  });
  pre("countDocuments", function () {
    const ctx = getTenantContext();
    if (ctx?.tenantId) this.where({ tenantId: ctx.tenantId });
  });
  pre("aggregate", function () {
    const ctx = getTenantContext();
    if (ctx?.tenantId) this.pipeline().unshift({ $match: { tenantId: ctx.tenantId } });
  });
  pre("save", function () {
    const ctx = getTenantContext();
    if (ctx?.tenantId && !this.get("tenantId")) this.set("tenantId", ctx.tenantId);
  });

  // insertMany bypasses `save` middleware entirely, so bulk seeding (tax
  // codes, UOMs, number series, expense categories, ...) needs its own hook
  // or every seeded row silently comes out tenant-less. Same no-next
  // convention as the other hooks above: this version of Mongoose calls the
  // hook as fn(docs, opts) with no callback, not the older fn(next, docs).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema.pre("insertMany", function (docs: any) {
    const ctx = getTenantContext();
    if (ctx?.tenantId && Array.isArray(docs)) {
      for (const doc of docs) {
        if (doc && typeof doc === "object" && !doc.tenantId) doc.tenantId = ctx.tenantId;
      }
    }
  });
}
