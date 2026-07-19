/**
 * @file What a `SKILL.md` is, in one place: frontmatter extraction, the
 * skill-name grammar, and fence-aware body walking. `resolve`, `lint`, `fmt`,
 * and `scaffold` all consume these, so their answers can't drift apart.
 */

import { parse } from "yaml";

/** Longest allowed skill name (from skill-creator's quick_validate.py). */
export const MAX_NAME_LENGTH = 64;

/** An opening frontmatter block, including its closing fence. CRLF-tolerant. */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** A markdown fence-delimiter line (``` or ~~~), possibly indented. */
const FENCE_RE = /^\s*(```|~~~)/;

/**
 * Split a `SKILL.md` into its frontmatter YAML text and body. Newlines are
 * passed through as-is — callers that care normalise first.
 *
 * @param {string} raw
 * @returns {{ yaml: string, body: string } | null}  Null when no block opens the file.
 */
export function splitFrontmatter(raw) {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return null;
  return { yaml: match[1], body: raw.slice(match[0].length) };
}

/**
 * Parse frontmatter YAML into a plain mapping.
 *
 * @param {string} yamlText
 * @returns {{ data: Record<string, unknown> | null, error: string | null }}
 */
export function parseFrontmatter(yamlText) {
  try {
    const data = parse(yamlText);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return { data, error: null };
    }
    return { data: null, error: "frontmatter must be a YAML mapping" };
  } catch (err) {
    const message = /** @type {Error} */ (err).message;
    return { data: null, error: `invalid YAML in frontmatter: ${message}` };
  }
}

/**
 * Violations of the skill-name grammar (rules and messages ported from
 * skill-creator's quick_validate.py). `lint` reports these and `new` refuses
 * to scaffold them — one grammar, two enforcement points.
 *
 * @param {string} name
 * @returns {Array<{ rule: string, message: string }>}
 */
export function skillNameProblems(name) {
  const problems = [];
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

/**
 * Map body lines with fence awareness — the shared notion of "inside a code
 * block" for anything that walks a SKILL.md body.
 *
 * @param {string} body
 * @param {(line: string, kind: "fence" | "inside" | "outside") => string | null} fn
 *   Return the (possibly rewritten) line, or null to drop it.
 * @returns {string[]}
 */
export function mapBodyLines(body, fn) {
  let inFence = false;
  const out = [];
  for (const line of body.split("\n")) {
    let kind;
    if (FENCE_RE.test(line)) {
      kind = "fence";
      inFence = !inFence;
    } else {
      kind = inFence ? "inside" : "outside";
    }
    const mapped = fn(line, /** @type {"fence"|"inside"|"outside"} */ (kind));
    if (mapped !== null) out.push(mapped);
  }
  return out;
}
