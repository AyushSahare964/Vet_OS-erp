/**
 * Body temperature as typed in the prescription (value + a °C/°F toggle) -> a consistent reading.
 * A dog or cat is about 38-39.5 °C, or 100-103 °F. A reading under 50 with °F selected, or 50 and over with °C
 * selected, is a mis-clicked unit (38.5 saved as °F became "3.6 °C"), so it is read in the other unit.
 */
export type TempUnit = "°C" | "°F";

export function resolveTemp(value: number, unit: TempUnit | string | undefined): { c: number; f: number; unit: TempUnit } {
  const asked: TempUnit = unit === "°F" ? "°F" : "°C";
  const u: TempUnit = asked === "°F" && value < 50 ? "°C" : asked === "°C" && value >= 50 ? "°F" : asked;
  const c = u === "°F" ? (value - 32) * (5 / 9) : value;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return { c: r1(c), f: r1(c * 9 / 5 + 32), unit: u };
}
