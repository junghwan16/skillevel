import { describe, expect, it } from "vitest";
import { formatSkillMd } from "../src/skill-md/format.js";

describe("formatSkillMd", () => {
  it("floats name and description to the top and keeps other keys in order", () => {
    const source = `---
license: MIT
description: does things
model: sonnet
name: my-skill
---
Body.
`;
    expect(formatSkillMd(source)).toBe(`---
name: my-skill
description: does things
license: MIT
model: sonnet
---

Body.
`);
  });

  it("strips trailing whitespace outside code fences, preserves it inside", () => {
    const source = "---\nname: s\n---\n\nprose  \n\n```\ncode  \n```\n";
    const formatted = formatSkillMd(source);
    expect(formatted).toContain("\nprose\n");
    expect(formatted).toContain("\ncode  \n");
  });

  it("normalises blank lines around the body and ends with one newline", () => {
    const source = "---\nname: s\n---\n\n\n\nBody.\n\n\n";
    expect(formatSkillMd(source)).toBe("---\nname: s\n---\n\nBody.\n");
  });

  it("is idempotent", () => {
    const source = "---\nlicense: MIT\nname: s\n---\nBody.  \n";
    const once = formatSkillMd(source);
    expect(formatSkillMd(once)).toBe(once);
  });

  it("returns the source unchanged when there is no parseable frontmatter", () => {
    expect(formatSkillMd("just prose\n")).toBe("just prose\n");
    expect(formatSkillMd("---\n[not: a: mapping\n---\nbody\n")).toBe(
      "---\n[not: a: mapping\n---\nbody\n",
    );
  });
});
