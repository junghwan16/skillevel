import { describe, expect, it } from "vitest";
import { lintSkillMd } from "../src/skill-md/lint.js";
import { withTempDir, write } from "./helpers.js";

function rulesOf(file: string): string[] {
  return lintSkillMd(file).problems.map((p) => p.rule);
}

describe("lintSkillMd", () => {
  it("accepts a well-formed skill", () => {
    withTempDir((dir) => {
      const file = write(
        dir,
        "my-skill/SKILL.md",
        `---
name: my-skill
description: Formats commit messages following the team conventions.
---

# my-skill

Do the thing.
`,
      );
      expect(lintSkillMd(file).problems).toEqual([]);
    });
  });

  it("reports missing frontmatter", () => {
    withTempDir((dir) => {
      const file = write(dir, "s/SKILL.md", "# no frontmatter\n");
      expect(rulesOf(file)).toContain("no-frontmatter");
    });
  });

  it("reports name-grammar and name/dir mismatch problems", () => {
    withTempDir((dir) => {
      const file = write(
        dir,
        "some-dir/SKILL.md",
        "---\nname: Bad_Name\ndescription: A long enough description here.\n---\nBody.\n",
      );
      const rules = rulesOf(file);
      expect(rules).toContain("name-not-kebab");
      expect(rules).toContain("name-dir-mismatch");
    });
  });

  it("reports unexpected frontmatter keys", () => {
    withTempDir((dir) => {
      const file = write(
        dir,
        "s/SKILL.md",
        "---\nname: s\ndescription: A long enough description here.\nbogus: true\n---\nBody.\n",
      );
      expect(rulesOf(file)).toContain("unexpected-key");
    });
  });

  it("warns on TODO placeholders but ignores templates in code spans", () => {
    withTempDir((dir) => {
      const file = write(
        dir,
        "s/SKILL.md",
        [
          "---",
          "name: s",
          "description: A long enough description here.",
          "---",
          "TODO finish this",
          "Use <insert value> here.",
          "But `git diff <fixed-point>` is fine.",
          "",
        ].join("\n"),
      );
      const problems = lintSkillMd(file).problems;
      const placeholders = problems.filter((p) => p.rule === "placeholder");
      expect(placeholders).toHaveLength(2); // TODO + <insert value>, not the code span
      expect(
        placeholders.some((p) => p.message.includes("<insert value>")),
      ).toBe(true);
    });
  });

  it("reports references to files that do not exist, accepts ones that do", () => {
    withTempDir((dir) => {
      write(dir, "s/references/guide.md", "hi");
      const file = write(
        dir,
        "s/SKILL.md",
        [
          "---",
          "name: s",
          "description: A long enough description here.",
          "---",
          "See references/guide.md and references/missing.md.",
          "",
        ].join("\n"),
      );
      const broken = lintSkillMd(file).problems.filter(
        (p) => p.rule === "broken-reference",
      );
      expect(broken).toHaveLength(1);
      expect(broken[0]!.message).toContain("references/missing.md");
    });
  });
});
