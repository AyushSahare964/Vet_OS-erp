import { describe, it, expect } from "vitest";
import { vetNameOf, isVetRole } from "@/lib/clinical/attendingVet";

describe("attending vet rule", () => {
  it("a doctor and the admin may be the attending vet", () => {
    expect(vetNameOf({ roleId: "doctor", fullName: "Dr. A" })).toBe("Dr. A");
    expect(vetNameOf({ roleId: "admin", fullName: "Dr. B" })).toBe("Dr. B");
  });
  it("a receptionist, accountant or nobody is never the attending vet", () => {
    expect(vetNameOf({ roleId: "reception", fullName: "Jyoti" })).toBe("");
    expect(vetNameOf({ roleId: "accounts", fullName: "Sam" })).toBe("");
    expect(vetNameOf(null)).toBe("");
    expect(isVetRole("reception")).toBe(false);
  });
});
