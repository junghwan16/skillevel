import { describe, expect, it } from "vitest";
import { runPool } from "../src/shared/pool.js";

describe("runPool", () => {
  it("runs every job and reports progress", async () => {
    const ran: number[] = [];
    const ticks: number[] = [];
    await runPool(
      [1, 2, 3].map((n) => async () => {
        ran.push(n);
      }),
      2,
      (done) => ticks.push(done),
    );
    expect(ran.sort()).toEqual([1, 2, 3]);
    expect(ticks).toEqual([1, 2, 3]);
  });

  it("never exceeds the pool size", async () => {
    let active = 0;
    let peak = 0;
    const job = () => async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    };
    await runPool(Array.from({ length: 10 }, job), 3);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it("handles an empty job list", async () => {
    await expect(runPool([], 4)).resolves.toBeUndefined();
  });
});
