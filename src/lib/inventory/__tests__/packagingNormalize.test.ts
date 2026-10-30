import { describe, it, expect } from "vitest";
import { resolveUnitPrice, convertToBase, getAvailableUnits, normalizeHierarchy, type PackagingHierarchy } from "@/lib/inventory/packagingUtils";

// Saved as "1 Vial = 10 Vial" with a Vial in between (Nobivac Rabies, I-0013): sold at ₹800 a vial
const vialAsVial: PackagingHierarchy = {
  baseUnit: "Vial", purchaseUnit: "Vial", baseUnitsPerPurchase: 10,
  hasIntermediateUnit: true, intermediateUnit: "Vial", intermediateUnitsPerPurchase: 1, baseUnitsPerIntermediate: 10,
};
// Saved with a stray "ml" in between (Inj perandin, I-0020): 10 bought used to become 300
const vialWithMl: PackagingHierarchy = {
  baseUnit: "Vial", purchaseUnit: "Vial", baseUnitsPerPurchase: 30,
  hasIntermediateUnit: true, intermediateUnit: "ml", intermediateUnitsPerPurchase: 1, baseUnitsPerIntermediate: 30,
};
const strips: PackagingHierarchy = { baseUnit: "Tablet", purchaseUnit: "Strip", baseUnitsPerPurchase: 10, hasIntermediateUnit: false };

describe("packaging with the same purchase and base unit", () => {
  it("prices a vial at the full price, not a tenth of it", () => expect(resolveUnitPrice(800, "Vial", vialAsVial)).toBe(800));
  it("lists the unit once, not twice", () => expect(getAvailableUnits(vialAsVial)).toEqual(["Vial"]));
  it("receives 10 bought as 10, not 300", () => expect(convertToBase(10, "ml", vialWithMl)).toBe(10));
  it("keeps a normal two-level pack untouched", () => {
    expect(normalizeHierarchy(strips)).toBe(strips);
    expect(resolveUnitPrice(500, "Tablet", strips)).toBe(50);
    expect(convertToBase(2, "Strip", strips)).toBe(20);
  });
});
