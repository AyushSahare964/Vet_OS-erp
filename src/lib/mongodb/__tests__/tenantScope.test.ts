import { describe, expect, it } from "vitest";
import { ErpRow } from "../models/ErpRow";
import { InventoryItem } from "../models/InventoryItem";
import { StockBatch } from "../models/StockBatch";
import { FinanceTransaction } from "../models/FinanceTransaction";
import { Pet } from "../models/Pet";
import { runWithTenant } from "../tenantContext";

/**
 * Regression: these models declare their own `tenantId`, and the scope plugin used to bail out early for any
 * schema that already had one — so their queries were never filtered and every clinic saw every other clinic's
 * appointments, stock, ledger and finance rows. Each must now carry the tenant filter hooks.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hookNames = (m: any): string[] => [...(m.schema.s.hooks._pres.keys?.() ?? Object.keys(m.schema.s.hooks._pres))].map(String);

describe("tenant scope plugin", () => {
  for (const [name, model] of Object.entries({ ErpRow, InventoryItem, StockBatch, FinanceTransaction, Pet })) {
    it(`${name} has tenantId and its query hooks installed`, () => {
      expect(model.schema.path("tenantId")).toBeTruthy();
      const names = hookNames(model);
      expect(names.some((n) => /find/.test(n))).toBe(true);
      expect(names).toContain("save");
    });
  }

  it("applies the current tenant to a find query", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finds = (ErpRow.schema.s.hooks as any)._pres.get("find") ?? [];
    expect(finds.length).toBeGreaterThan(0);
    const where: Array<Record<string, unknown>> = [];
    const fake = { where: (f: Record<string, unknown>) => void where.push(f) };
    await runWithTenant({ tenantId: "tid_a", userId: "u", roleId: "admin" }, async () => {
      for (const h of finds) h.fn.call(fake);
    });
    expect(where).toContainEqual({ tenantId: "tid_a" });
  });
});
