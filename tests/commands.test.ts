/**
 * End-to-end command tests, fully offline: real YAML on disk, a fake agent
 * runner, in-memory io — exactly what a user sees, minus the `claude` spend.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { benchCommand } from "../src/commands/bench.js";
import { runCommand } from "../src/commands/run.js";
import { validateCommand } from "../src/commands/validate.js";
import { FakeRunner, constantRunner, outcome, testContext } from "./helpers.js";

let dir: string;
let previousCwd: string;

beforeEach(() => {
  previousCwd = process.cwd();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "skillevel-cmd-"));
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(previousCwd);
  fs.rmSync(dir, { recursive: true, force: true });
});

function writeSuite(name: string, yaml: string): void {
  fs.writeFileSync(path.join(dir, name), yaml);
}

const SUITE = [
  "skill: sql",
  "trials: 2",
  "cases:",
  "  - id: happy-1",
  "    prompt: write a query",
  "    should_trigger: true",
  "  - id: todo-1",
  "    prompt: '<unwritten>'",
  "    should_trigger: true",
].join("\n");

describe("runCommand", () => {
  it("exits 0 and prints the grid when every case passes", async () => {
    writeSuite("sql.eval.yaml", SUITE);
    const ctx = testContext(constantRunner(outcome({ skillsFired: ["sql"] })));
    const code = await runCommand(undefined, {}, ctx);
    expect(code).toBe(0);
    expect(ctx.io.stdout).toContain("happy-1");
    expect(ctx.io.stdout).toContain("2/2");
    expect(ctx.io.stdout).toContain("TODO — unwritten");
    expect(ctx.io.stdout).toContain("1 passed");
  });

  it("exits 1 when a case fails", async () => {
    writeSuite("sql.eval.yaml", SUITE);
    const ctx = testContext(constantRunner(outcome({ skillsFired: [] })));
    expect(await runCommand(undefined, {}, ctx)).toBe(1);
    expect(ctx.io.stdout).toContain("1 failed");
  });

  it("--ci makes todo cases fail the run", async () => {
    writeSuite("sql.eval.yaml", SUITE);
    const passing = testContext(
      constantRunner(outcome({ skillsFired: ["sql"] })),
    );
    expect(await runCommand(undefined, { ci: true }, passing)).toBe(1);
  });

  it("empty discovery fails only under --ci", async () => {
    const empty = testContext(constantRunner(outcome()));
    expect(await runCommand(undefined, { ci: true }, empty)).toBe(1);
    expect(await runCommand(undefined, { ci: false }, empty)).toBe(0);
    expect(empty.io.stderr).toContain("no eval suites found");
  });

  it("writes machine-readable results with --json", async () => {
    writeSuite("sql.eval.yaml", SUITE);
    const ctx = testContext(constantRunner(outcome({ skillsFired: ["sql"] })));
    await runCommand(undefined, { json: "out.json" }, ctx);
    const results = JSON.parse(fs.readFileSync("out.json", "utf8"));
    expect(results[0].skill).toBe("sql");
    expect(results[0].cases).toHaveLength(2);
  });

  it("reports a runner failure as a clean error, not a stack trace", async () => {
    writeSuite("sql.eval.yaml", SUITE);
    const ctx = testContext(
      new FakeRunner(() => {
        throw new Error("`claude` CLI not found on PATH");
      }),
    );
    expect(await runCommand(undefined, {}, ctx)).toBe(1);
    expect(ctx.io.stderr).toContain("`claude` CLI not found");
  });
});

describe("benchCommand", () => {
  const BENCH_SUITE = [
    "skill: sql",
    "cases:",
    "  - id: happy-1",
    "    prompt: write a query",
    "    should_trigger: true",
    "    expect:",
    "      - match: SELECT",
  ].join("\n");

  it("reports the lift and honours --min-lift", async () => {
    writeSuite("sql.eval.yaml", BENCH_SUITE);
    const runner = new FakeRunner((_prompt, options) =>
      outcome({ text: options.disallowSkills ? "dunno" : "SELECT 1" }),
    );
    const ctx = testContext(runner);
    expect(await benchCommand(undefined, { trials: 2 }, ctx)).toBe(0);
    expect(ctx.io.stdout).toContain("skill lift");
    expect(ctx.io.stdout).toContain("+100pp");

    const flat = testContext(constantRunner(outcome({ text: "SELECT 1" })));
    expect(
      await benchCommand(undefined, { trials: 2, minLift: 10 }, flat),
    ).toBe(1);
  });

  it("exits 1 with --min-lift when nothing is benchable", async () => {
    writeSuite(
      "sql.eval.yaml",
      "skill: sql\ncases:\n  - id: a\n    prompt: p\n    should_trigger: true",
    );
    const ctx = testContext(constantRunner(outcome()));
    expect(await benchCommand(undefined, { minLift: 1 }, ctx)).toBe(1);
    expect(ctx.io.stdout).toContain("nothing to bench");
  });
});

describe("validateCommand", () => {
  it("previews run counts offline without touching the runner", () => {
    writeSuite("sql.eval.yaml", SUITE);
    const runner = constantRunner(outcome());
    const ctx = testContext(runner);
    expect(validateCommand(undefined, {}, ctx)).toBe(0);
    expect(runner.calls).toHaveLength(0);
    expect(ctx.io.stdout).toContain("1 happy");
    expect(ctx.io.stdout).toContain("1 todo");
    expect(ctx.io.stdout).toContain("≈ 2 claude run(s)");
  });

  it("exits 1 when a file fails to parse", () => {
    writeSuite("bad.eval.yaml", "cases: []");
    const ctx = testContext(constantRunner(outcome()));
    expect(validateCommand(undefined, {}, ctx)).toBe(1);
    expect(ctx.io.stderr).toContain("missing 'skill'");
  });
});
