import { describe, expect, it } from "vitest";
import { apptStartMs, formatApptDate, formatApptTime } from "@/lib/email/appointmentReminder";

describe("appointment reminder formatting", () => {
  it("formats the stored ISO date as DD/MM/YYYY without shifting the day", () => {
    expect(formatApptDate("2026-10-21")).toBe("21/10/2026");
    expect(formatApptDate("2026-10-21T00:00:00.000Z")).toBe("21/10/2026");
  });
  it("rejects numbers, decimals, impossible and empty dates", () => {
    for (const bad of [0.0010365251727541954, 1792000000000, "2026-02-30", "", null, undefined]) expect(formatApptDate(bad)).toBe("");
  });
  it("formats times in 12-hour form", () => {
    expect(formatApptTime("10:30 AM")).toBe("10:30 AM");
    expect(formatApptTime("9:05 pm")).toBe("9:05 PM");
    expect(formatApptTime("14:30")).toBe("2:30 PM");
    expect(formatApptTime("00:15")).toBe("12:15 AM");
    expect(formatApptTime("25:00")).toBe("");
    expect(formatApptTime(undefined)).toBe("");
  });
  it("computes the IST start instant", () => {
    expect(new Date(apptStartMs("2026-10-21", "10:30 AM")!).toISOString()).toBe("2026-10-21T05:00:00.000Z");
    expect(apptStartMs("bad", "10:30 AM")).toBeNull();
  });
});
