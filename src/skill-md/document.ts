/**
 * What a `SKILL.md` is, in one place: frontmatter extraction, the skill-name
 * grammar, and fence-aware body walking. `resolve`, `lint`, `fmt`, and the
 * scaffolder all consume these, so their answers can't drift apart.
 */

import { parse } from "yaml";

/** Longest allowed skill name (from skill-creator's quick_validate.py). */
export const MAX_NAME_LENGTH = 64;

/** An opening frontmatter block, including its closing fence. CRLF-tolerant. */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** A markdown fence-delimiter line (``` or ~~~), possibly indented. */
const FENCE_RE = /^\s*(```|~~~)/;

export interface FrontmatterBlock {
  yaml: string;
  body: string;
}

/**
 * Split a `SKILL.md` into its frontmatter YAML text and body. Newlines are
 * passed through as-is — callers that care normalise first. Null when no
 * block opens the file.
 */
export function splitFrontmatter(raw: string): FrontmatterBlock | null {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return null;
  return { yaml: match[1]!, body: raw.slice(match[0].length) };
}

export interface ParsedFrontmatter {
  data: Record<string, unknown> | null;
  error: string | null;
}

/** Parse frontmatter YAML into a plain mapping. */
export function parseFrontmatter(yamlText: string): ParsedFrontmatter {
  try {
    const data: unknown = parse(yamlText);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return { data: data as Record<string, unknown>, error: null };
    }
    return { data: null, error: "frontmatter must be a YAML mapping" };
  } catch (err) {
    const message = (err as Error).message;
    return { data: null, error: `invalid YAML in frontmatter: ${message}` };
  }
}

export interface NameProblem {
  rule: string;
  message: string;
}

/**
 * Violations of the skill-name grammar (rules and messages ported from
 * skill-creator's quick_validate.py). `lint` reports these and `new` refuses
 * to scaffold them — one grammar, two enforcement points.
 */
export function skillNameProblems(name: string): NameProblem[] {
  const problems: NameProblem[] = [];
  if (!/^[a-z0-9-]+$/.test(name)) {
    problems.push({
      rule: "name-not-kebab",
      message: `name '${name}' should be kebab-case (lowercase letters, digits, and hyphens only)`,
    });
  }
  if (name.startsWith("-") || name.endsWith("-") || name.includes("--")) {
    problems.push({
      rule: "name-bad-hyphens",
      message: `name '${name}' cannot start/end with hyphen or contain consecutive hyphens`,
    });
  }
  if (name.length > MAX_NAME_LENGTH) {
    problems.push({
      rule: "name-too-long",
      message: `name is too long (${name.length} characters, max ${MAX_NAME_LENGTH})`,
    });
  }
  return problems;
}

export type LineKind = "fence" | "inside" | "outside";

/**
 * Map body lines with fence awareness — the shared notion of "inside a code
 * block" for anything that walks a SKILL.md body. Return the (possibly
 * rewritten) line, or null to drop it.
 */
export function mapBodyLines(
  body: string,
  fn: (line: string, kind: LineKind) => string | null,
): string[] {
  let inFence = false;
  const out: string[] = [];
  for (const line of body.split("\n")) {
    let kind: LineKind;
    if (FENCE_RE.test(line)) {
      kind = "fence";
      inFence = !inFence;
    } else {
      kind = inFence ? "inside" : "outside";
    }
    const mapped = fn(line, kind);
    if (mapped !== null) out.push(mapped);
  }
  return out;
}
