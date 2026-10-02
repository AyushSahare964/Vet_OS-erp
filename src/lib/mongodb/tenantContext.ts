/**
 * Per-request tenant context. Set by tenantScoped() (client.ts) wrapping a
 * server function handler, read by tenantScopePlugin on every Mongoose
 * query so tenant data never crosses into another tenant's queries.
 *
 * The AsyncLocalStorage instance lives on globalThis (same pattern as
 * client.ts's __mongooseCache) so a handler wrapped in one bundled chunk
 * and a model's query hook living in another always share the same store.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  tenantId: string;
  userId: string;
  roleId: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __tenantContextStorage: AsyncLocalStorage<TenantContext> | undefined;
}

const storage: AsyncLocalStorage<TenantContext> =
  global.__tenantContextStorage ?? new AsyncLocalStorage<TenantContext>();
if (!global.__tenantContextStorage) {
  global.__tenantContextStorage = storage;
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/**
 * Runs `fn` with the given tenant context active for its entire execution,
 * including every query it awaits. This is the only reliable propagation
 * pattern here — enterWith() does not survive the return from connectDB()
 * back into a handler's subsequent awaits in this TanStack Start / Nitro
 * dev setup (confirmed by direct instrumentation), so context must be
 * established by wrapping the call, not by "entering" it beforehand.
 */
export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}
