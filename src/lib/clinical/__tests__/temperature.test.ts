import { describe, it, expect } from "vitest";
import { resolveTemp } from "@/lib/clinical/temperature";

describe("resolveTemp", () => {
  it("keeps a normal Celsius reading", () => expect(resolveTemp(38.5, "°C")).toEqual({ c: 38.5, f: 101.3, unit: "°C" }));
  it("converts a real Fahrenheit reading", () => expect(resolveTemp(101.3, "°F")).toEqual({ c: 38.5, f: 101.3, unit: "°F" }));
  it("reads 38.5 saved as °F (mis-click) as Celsius, not 3.6 °C", () => expect(resolveTemp(38.5, "°F").c).toBe(38.5));
  it("reads 101 saved as °C (mis-click) as Fahrenheit", () => expect(resolveTemp(101, "°C").unit).toBe("°F"));
  it("defaults to Celsius", () => expect(resolveTemp(38.2, undefined).unit).toBe("°C"));
});
