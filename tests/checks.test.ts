import { describe, expect, it, vi } from "vitest";
import type { Judge } from "../src/agent/judge.js";
import {
  evaluateOutputChecks,
  evaluateTrial,
  triggerCheck,
} from "../src/core/checks.js";
import type { TestCase } from "../src/core/types.js";
import { outcome } from "./helpers.js";

const noJudge: Judge = () => {
  throw new Error("judge must not be called");
};

function testCase(overrides: Partial<TestCase>): TestCase {
  return { id: "case", prompt: "p", should_trigger: true, ...overrides };
}

describe("triggerCheck", () => {
  it("passes a happy case when the target skill fired", () => {
    const check = triggerCheck(
      testCase({ should_trigger: true }),
      "sql",
      outcome({ skillsFired: ["sql"] }),
    );
    expect(check).toMatchObject({ label: "triggers sql", ok: true });
  });

  it("fails a negative case when the target skill fired, listing what fired", () => {
    const check = triggerCheck(
      testCase({ should_trigger: false }),
      "sql",
      outcome({ skillsFired: ["sql"] }),
    );
    expect(check).toMatchObject({
      label: "stays out (sql)",
      ok: false,
      detail: "fired: sql",
    });
  });

  it("expect_skill: none passes only when nothing fired", () => {
    const none = testCase({ should_trigger: false, expect_skill: "none" });
    expect(triggerCheck(none, "sql", outcome()).ok).toBe(true);
    const fired = triggerCheck(
      none,
      "sql",
      outcome({ skillsFired: ["other"] }),
    );
    expect(fired).toMatchObject({ label: "no skill fires", ok: false });
  });

  it("expect_skill: sibling requires the sibling to win and the target to stay out", () => {
    const routed = testCase({ should_trigger: false, expect_skill: "pandas" });
    expect(
      triggerCheck(routed, "sql", outcome({ skillsFired: ["pandas"] })).ok,
    ).toBe(true);
    expect(
      triggerCheck(routed, "sql", outcome({ skillsFired: ["pandas", "sql"] }))
        .ok,
    ).toBe(false);
    expect(triggerCheck(routed, "sql", outcome({ skillsFired: [] })).ok).toBe(
      false,
    );
  });

  it("expect_skill naming the suite's own skill behaves as should_trigger", () => {
    const own = testCase({ should_trigger: true, expect_skill: "sql" });
    const check = triggerCheck(own, "sql", outcome({ skillsFired: ["sql"] }));
    expect(check).toMatchObject({ label: "triggers sql", ok: true });
  });
});

describe("evaluateOutputChecks", () => {
  it("evaluates match and absent as case-insensitive regexes", async () => {
    const tc = testCase({
      expect: ["triggered", { match: "select" }, { absent: "delete" }],
    });
    const checks = await evaluateOutputChecks(
      tc,
      outcome({ text: "SELECT * FROM t" }),
      noJudge,
    );
    // the "triggered" shorthand is skipped — only output checks remain
    expect(checks.map((c) => c.ok)).toEqual([true, true]);
  });

  it("falls back to a literal substring match on invalid regex", async () => {
    const tc = testCase({ expect: [{ match: "a(b" }] });
    const checks = await evaluateOutputChecks(
      tc,
      outcome({ text: "found a(b here" }),
      noJudge,
    );
    expect(checks[0]!.ok).toBe(true);
  });

  it("delegates judge checks to the injected judge", async () => {
    const judge = vi
      .fn<Judge>()
      .mockResolvedValue({ ok: false, reason: "too vague" });
    const tc = testCase({ expect: [{ judge: "is it correct?" }] });
    const checks = await evaluateOutputChecks(
      tc,
      outcome({ text: "answer" }),
      judge,
    );
    expect(judge).toHaveBeenCalledWith("is it correct?", "answer");
    expect(checks[0]).toMatchObject({
      label: "judge",
      ok: false,
      detail: "too vague",
    });
  });
});

describe("evaluateTrial", () => {
  it("prepends the trigger check to the output checks", async () => {
    const tc = testCase({ expect: [{ match: "yes" }] });
    const checks = await evaluateTrial(
      tc,
      "sql",
      outcome({ skillsFired: ["sql"], text: "yes" }),
      noJudge,
    );
    expect(checks.map((c) => c.label)).toEqual(["triggers sql", "match /yes/"]);
    expect(checks.every((c) => c.ok)).toBe(true);
  });
});
