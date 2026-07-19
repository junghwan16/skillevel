import { describe, expect, it } from "vitest";
import { createJudge } from "../src/agent/judge.js";
import { FakeRunner, outcome } from "./helpers.js";

describe("createJudge", () => {
  it("passes on a PASS verdict and extracts the reason", async () => {
    const runner = new FakeRunner(() =>
      outcome({ text: "PASS\nthe query is read-only" }),
    );
    const verdict = await createJudge(runner)("read-only?", "SELECT 1");
    expect(verdict).toEqual({ ok: true, reason: "the query is read-only" });
  });

  it("fails on a FAIL verdict (case-insensitive first word)", async () => {
    const runner = new FakeRunner(() => outcome({ text: "fail\nuses DELETE" }));
    const verdict = await createJudge(runner)("read-only?", "DELETE ...");
    expect(verdict.ok).toBe(false);
  });

  it("treats anything else as a failure, not a pass", async () => {
    const runner = new FakeRunner(() =>
      outcome({ text: "Sure! Overall good." }),
    );
    const verdict = await createJudge(runner)("q", "a");
    expect(verdict.ok).toBe(false);
  });

  it("embeds the rubric and the answer in a single-turn prompt", async () => {
    const runner = new FakeRunner(() => outcome({ text: "PASS" }));
    await createJudge(runner, "opus")("is it polite?", "hello there");
    const call = runner.calls[0]!;
    expect(call.prompt).toContain("Criterion: is it polite?");
    expect(call.prompt).toContain("hello there");
    expect(call.options).toMatchObject({ model: "opus", maxTurns: 1 });
  });

  it("truncates a huge answer before sending it to the model", async () => {
    const runner = new FakeRunner(() => outcome({ text: "PASS" }));
    await createJudge(runner)("q", "x".repeat(20_000));
    expect(runner.calls[0]!.prompt.length).toBeLessThan(10_000);
  });
});
