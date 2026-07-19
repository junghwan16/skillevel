/**
 * Lints a `SKILL.md` — frontmatter errors ported from skill-creator's
 * `quick_validate.py`, plus authoring-guidance warnings. Pure: no console
 * output; read failures become a problem, not a throw.
 */

import fs from "node:fs";
import path from "node:path";
import {
  mapBodyLines,
  parseFrontmatter,
  skillNameProblems,
  splitFrontmatter,
} from "./document.js";

export interface Problem {
  severity: "error" | "warning";
  /** Short kebab-case id, e.g. "name-not-kebab". */
  rule: string;
  message: string;
}

export interface LintResult {
  file: string;
  problems: Problem[];
}

interface LintContext {
  /** Directory containing the SKILL.md. */
  skillDir: string;
  /** Full file contents, newlines normalised to \n. */
  raw: string;
  /** A `---\n...\n---` block opens the file. */
  hasFrontmatterBlock: boolean;
  /** Parsed mapping, or null. */
  frontmatter: Record<string, unknown> | null;
  /** Parse failure detail, if any. */
  yamlError: string | null;
  /** Everything after the frontmatter block. */
  body: string;
  /** Body with fenced code blocks removed. */
  prose: string;
}

const ALLOWED_KEYS = new Set([
  // claude.ai / API packaging keys (skill-creator's quick_validate.py)
  "name",
  "description",
  "license",
  "allowed-tools",
  "metadata",
  "compatibility",
  // Claude Code skill keys — valid in SKILL.md even though the claude.ai
  // packager doesn't know them
  "argument-hint",
  "disable-model-invocation",
  "user-invocable",
  "model",
  "context",
  "agent",
]);

const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_COMPATIBILITY_LENGTH = 500;
const MAX_BODY_LINES = 500;
const MIN_DESCRIPTION_LENGTH = 20;

/** Angle-bracket placeholders like `<skill-name>` or `<describe the task>`. */
const PLACEHOLDER_RE = /<[a-z][a-z0-9 _-]*>/gi;

/** Relative references like `references/x.md` — not preceded by a path/URL. */
const REFERENCE_RE = /(?<![\w/:.-])(?:references|scripts|assets)\/[\w./-]+/g;

/** Lint a `SKILL.md` file. */
export function lintSkillMd(skillMdPath: string): LintResult {
  let raw: string;
  try {
    raw = fs.readFileSync(skillMdPath, "utf8");
  } catch (err) {
    const message = `cannot read ${skillMdPath}: ${(err as Error).message}`;
    return { file: skillMdPath, problems: [error("unreadable", message)] };
  }
  // Universal-newline translation, like the Path.read_text() call in
  // skill-creator's quick_validate.py — CRLF files are valid skills.
  const ctx = buildContext(skillMdPath, raw.replace(/\r\n?/g, "\n"));
  return {
    file: skillMdPath,
    problems: [
      ...checkFrontmatter(ctx),
      ...checkName(ctx),
      ...checkDescription(ctx),
      ...checkCompatibility(ctx),
      ...checkGuidance(ctx),
    ],
  };
}

/** Parse the file once; every check reads from this context. */
function buildContext(skillMdPath: string, raw: string): LintContext {
  const block = splitFrontmatter(raw);
  let frontmatter: Record<string, unknown> | null = null;
  let yamlError: string | null = null;
  if (block)
    ({ data: frontmatter, error: yamlError } = parseFrontmatter(block.yaml));
  const body = block ? block.body : raw;
  return {
    skillDir: path.dirname(skillMdPath),
    raw,
    hasFrontmatterBlock: Boolean(block),
    frontmatter,
    yamlError,
    body,
    prose: mapBodyLines(body, (line, kind) =>
      kind === "outside" ? line : null,
    ).join("\n"),
  };
}

// --- error checks (ported from skill-creator's quick_validate.py) ----------

function checkFrontmatter(ctx: LintContext): Problem[] {
  if (!ctx.hasFrontmatterBlock) {
    const message = ctx.raw.startsWith("---")
      ? "invalid frontmatter format (expected ---\\n...\\n--- at the top)"
      : "no YAML frontmatter found";
    return [error("no-frontmatter", message)];
  }
  if (!ctx.frontmatter)
    return [
      error("invalid-frontmatter", ctx.yamlError ?? "invalid frontmatter"),
    ];
  const unexpected = Object.keys(ctx.frontmatter).filter(
    (key) => !ALLOWED_KEYS.has(key),
  );
  if (unexpected.length === 0) return [];
  const allowed = [...ALLOWED_KEYS].sort().join(", ");
  const message = `unexpected frontmatter key(s): ${unexpected.sort().join(", ")} (allowed: ${allowed})`;
  return [error("unexpected-key", message)];
}

function checkName(ctx: LintContext): Problem[] {
  if (!ctx.frontmatter) return [];
  if (!("name" in ctx.frontmatter)) {
    return [error("missing-name", "missing 'name' in frontmatter")];
  }
  const name = ctx.frontmatter.name;
  if (typeof name !== "string") {
    return [
      error("name-not-string", `name must be a string, got ${typeof name}`),
    ];
  }
  const trimmed = name.trim();
  if (!trimmed) return []; // quick_validate.py skips shape checks on empty values
  return skillNameProblems(trimmed).map(({ rule, message }) =>
    error(rule, message),
  );
}

function checkDescription(ctx: LintContext): Problem[] {
  if (!ctx.frontmatter) return [];
  if (!("description" in ctx.frontmatter)) {
    return [
      error("missing-description", "missing 'description' in frontmatter"),
    ];
  }
  const description = ctx.frontmatter.description;
  if (typeof description !== "string") {
    const message = `description must be a string, got ${typeof description}`;
    return [error("description-not-string", message)];
  }
  const trimmed = description.trim();
  if (!trimmed) return [];
  const problems: Problem[] = [];
  if (/[<>]/.test(trimmed)) {
    // Fine in Claude Code, but the claude.ai skill packager rejects it.
    const message =
      "description contains angle brackets (< or >) — claude.ai packaging rejects them";
    problems.push(warning("description-angle-brackets", message));
  }
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    const message = `description is too long (${trimmed.length} characters, max ${MAX_DESCRIPTION_LENGTH})`;
    problems.push(error("description-too-long", message));
  }
  return problems;
}

function checkCompatibility(ctx: LintContext): Problem[] {
  const compatibility = ctx.frontmatter?.compatibility;
  if (compatibility === undefined || compatibility === null) return [];
  if (typeof compatibility !== "string") {
    const message = `compatibility must be a string, got ${typeof compatibility}`;
    return [error("compatibility-not-string", message)];
  }
  if (compatibility.length <= MAX_COMPATIBILITY_LENGTH) return [];
  const message = `compatibility is too long (${compatibility.length} characters, max ${MAX_COMPATIBILITY_LENGTH})`;
  return [error("compatibility-too-long", message)];
}

// --- warning checks (from skill-creator's authoring guidance) --------------

function checkGuidance(ctx: LintContext): Problem[] {
  const problems: Problem[] = [];

  const lines = ctx.body.replace(/\n$/, "").split("\n").length;
  if (lines > MAX_BODY_LINES) {
    const message = `body is ${lines} lines; keep SKILL.md under ${MAX_BODY_LINES} lines and layer details into references/`;
    problems.push(warning("too-long", message));
  }

  const name =
    typeof ctx.frontmatter?.name === "string"
      ? ctx.frontmatter.name.trim()
      : "";
  const dirName = path.basename(ctx.skillDir);
  if (name && name !== dirName) {
    const message = `frontmatter name '${name}' differs from directory name '${dirName}'`;
    problems.push(warning("name-dir-mismatch", message));
  }

  const description = ctx.frontmatter?.description;
  if (typeof description === "string") {
    const trimmed = description.trim();
    if (trimmed.includes("TODO")) {
      problems.push(
        warning("description-unwritten", "description contains TODO"),
      );
    } else if (trimmed.length < MIN_DESCRIPTION_LENGTH) {
      const message = `description is only ${trimmed.length} characters; write what the skill does and when to use it`;
      problems.push(warning("description-unwritten", message));
    }
  }

  // Strip inline `code` spans first: `git diff <fixed-point>...HEAD` is a
  // command template, not a leftover placeholder (fmt already spares fences).
  const proseNoCode = ctx.prose.replace(/`[^`\n]*`/g, "");
  const angle = (proseNoCode.match(PLACEHOLDER_RE) ?? []).filter((tag) =>
    /[ -]/.test(tag.slice(1, -1)),
  );
  if (angle.length > 0) {
    const message = `body contains angle-bracket placeholder(s): ${dedupe(angle).join(", ")}`;
    problems.push(warning("placeholder", message));
  }
  if (/\bTODO\b/.test(ctx.prose)) {
    problems.push(warning("placeholder", "body contains TODO"));
  }

  const refs = (ctx.prose.match(REFERENCE_RE) ?? []).map((ref) =>
    ref.replace(/[.,;:]+$/, ""),
  );
  for (const ref of dedupe(refs)) {
    if (!fs.existsSync(path.join(ctx.skillDir, ref))) {
      problems.push(
        warning("broken-reference", `referenced file does not exist: ${ref}`),
      );
    }
  }

  return problems;
}

// --- helpers ---------------------------------------------------------------

function error(rule: string, message: string): Problem {
  return { severity: "error", rule, message };
}

function warning(rule: string, message: string): Problem {
  return { severity: "warning", rule, message };
}

/** Unique values, first-seen order. */
function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
