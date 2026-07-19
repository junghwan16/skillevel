import { describe, expect, it } from "vitest";
import { collectSuites, loadSuite } from "../src/suite/load.js";
import { withTempDir, write } from "./helpers.js";

describe("loadSuite", () => {
  it("loads a valid suite and records its source file", () => {
    withTempDir((dir) => {
      const file = write(
        dir,
        "sql.eval.yaml",
        [
          "skill: sql",
          "trials: 2",
          "cases:",
          "  - id: happy-1",
          "    prompt: run a query",
          "    should_trigger: true",
        ].join("\n"),
      );
      const suite = loadSuite(file);
      expect(suite).toMatchObject({ skill: "sql", trials: 2, file });
      expect(suite.cases).toHaveLength(1);
    });
  });

  it.each([
    [
      "missing skill",
      "cases:\n  - id: a\n    prompt: p\n    should_trigger: true",
      /missing 'skill'/,
    ],
    ["no cases", "skill: sql\ncases: []", /no 'cases'/],
    [
      "case without id",
      "skill: sql\ncases:\n  - prompt: p\n    should_trigger: true",
      /missing 'id'/,
    ],
    [
      "case without prompt",
      "skill: sql\ncases:\n  - id: a\n    should_trigger: true",
      /missing 'prompt'/,
    ],
    [
      "both trigger declarations",
      "skill: sql\ncases:\n  - id: a\n    prompt: p\n    should_trigger: true\n    expect_skill: sql",
      /exactly one of/,
    ],
    [
      "neither trigger declaration",
      "skill: sql\ncases:\n  - id: a\n    prompt: p",
      /exactly one of/,
    ],
    [
      "duplicate ids",
      "skill: sql\ncases:\n  - id: a\n    prompt: p\n    should_trigger: true\n  - id: a\n    prompt: p\n    should_trigger: false",
      /duplicate case id 'a'/,
    ],
  ])("rejects a suite with %s", (_name, yaml, message) => {
    withTempDir((dir) => {
      const file = write(dir, "bad.eval.yaml", yaml);
      expect(() => loadSuite(file)).toThrow(message);
    });
  });

  it("derives should_trigger from expect_skill", () => {
    withTempDir((dir) => {
      const file = write(
        dir,
        "sql.eval.yaml",
        [
          "skill: sql",
          "cases:",
          "  - id: own",
          "    prompt: p",
          "    expect_skill: sql",
          "  - id: sibling",
          "    prompt: p",
          "    expect_skill: pandas",
          "  - id: none",
          "    prompt: p",
          "    expect_skill: none",
        ].join("\n"),
      );
      const flags = loadSuite(file).cases.map((c) => c.should_trigger);
      expect(flags).toEqual([true, false, false]);
    });
  });
});

describe("collectSuites", () => {
  it("separates loadable suites from broken files", () => {
    withTempDir((dir) => {
      write(
        dir,
        "good.eval.yaml",
        "skill: good\ncases:\n  - id: a\n    prompt: p\n    should_trigger: true",
      );
      write(dir, "bad.eval.yaml", "cases: []");
      const { suites, skipped } = collectSuites(undefined, undefined, dir);
      expect(suites.map((s) => s.skill)).toEqual(["good"]);
      expect(skipped).toHaveLength(1);
      expect(skipped[0]!.file).toContain("bad.eval.yaml");
    });
  });

  it("filters cases by id substring and tracks fully-filtered files", () => {
    withTempDir((dir) => {
      write(
        dir,
        "sql.eval.yaml",
        [
          "skill: sql",
          "cases:",
          "  - id: happy-1",
          "    prompt: p",
          "    should_trigger: true",
          "  - id: neg-1",
          "    prompt: p",
          "    should_trigger: false",
        ].join("\n"),
      );
      write(
        dir,
        "other.eval.yaml",
        "skill: other\ncases:\n  - id: happy-2\n    prompt: p\n    should_trigger: true",
      );

      const negatives = collectSuites(undefined, "neg", dir);
      expect(negatives.suites).toHaveLength(1);
      expect(negatives.suites[0]!.cases.map((c) => c.id)).toEqual(["neg-1"]);
      expect(negatives.filteredOut).toHaveLength(1);
      expect(negatives.filteredOut[0]).toContain("other.eval.yaml");
    });
  });
});
