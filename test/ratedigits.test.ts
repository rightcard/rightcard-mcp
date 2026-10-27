// The engine's percent and multiplier labels keep up to two decimals, the
// same rule as Swift's LocalNumber.decimal (Oct 27 2026: "1.2%" on Home for
// a 1.25% card that the Wallet tab showed as 1.25%). Ties round the way
// Swift's printf does, on the double's exact value.
import { describe, it, expect } from "vitest";
import { formatPercent, formatMultiplier } from "../src/engine.js";

describe("rate digits", () => {
  it("keeps up to two decimals and drops trailing zeros", () => {
    expect(formatPercent(1.25)).toBe("1.25%");
    expect(formatPercent(2.7)).toBe("2.7%");
    expect(formatPercent(5)).toBe("5%");
    expect(formatPercent(1.5 * 1.1)).toBe("1.65%");
    expect(formatPercent(1.999)).toBe("2%");
    expect(formatMultiplier(1.25)).toBe("1.25x");
    expect(formatMultiplier(1.5)).toBe("1.5x");
  });
  it("rounds an exact tie to even, like printf", () => {
    expect(formatPercent(1.375)).toBe("1.38%");
    expect(formatPercent(1.125)).toBe("1.12%");
    expect(formatPercent(0.625)).toBe("0.62%");
    expect(formatPercent(2.675)).toBe("2.67%"); // not a tie: 2.67499999…
  });
});
