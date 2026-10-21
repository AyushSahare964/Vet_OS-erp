import { describe, expect, it } from "vitest";
import { addDaysYmd, daysRemaining, dueStage, stageContent } from "@/lib/trial/trialSchedule";

const start = "2026-10-01";
const end = addDaysYmd(start, 15); // 2026-10-16
const at = (n: number) => addDaysYmd(start, n);

describe("trial schedule", () => {
  it("ends 15 days after start", () => {
    expect(end).toBe("2026-10-16");
    expect(daysRemaining(end, start)).toBe(15);
  });
  it("picks the stage for each day", () => {
    const f = (n: number, fu = 3) => dueStage(end, at(n), fu);
    expect(f(0)).toBe("welcome");
    expect(f(7)).toBe("welcome");
    expect(f(8)).toBe("day8");
    expect(f(12)).toBe("day12");
    expect(f(14)).toBe("day14");
    expect(f(15)).toBe("expiry");
    expect(f(17)).toBe("expiry");
    expect(f(18)).toBe("followup");
    expect(f(18, 0)).toBe("expiry");
  });
  it("sends only the latest stage after downtime", () => {
    expect(dueStage(end, at(13), 3)).toBe("day12");
  });
  it("formats the end date as DD/MM/YYYY", () => {
    expect(stageContent("day8", "Acme Vet", end).email_message).toContain("16/10/2026");
  });
});
