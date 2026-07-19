/**
 * Locates `SKILL.md` files — by skill name (a working copy under the current
 * directory wins over the installed one), by path, or by walking the tree —
 * and reads the bits `new` needs.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MAX_WALK_DEPTH, WALK_SKIP_DIRS } from "../core/constants.js";
import { walkDir, type WalkEntry } from "../shared/fs-walk.js";
import { parseFrontmatter, splitFrontmatter } from "../skill-md/document.js";

export interface SkillMeta {
  /** Path to the `SKILL.md`. */
  path: string;
  source: "local" | "installed";
  /** Frontmatter `name`, or the folder name. */
  name: string;
  /** Frontmatter `description`. */
  description: string;
  /** Verbatim trigger-keyword line, if any. */
  triggers?: string;
}

/**
 * Find a skill's `SKILL.md`. Prefers a working copy under `root`; falls back
 * to `~/.claude/skills/<name>/SKILL.md`.
 */
export function findSkill(
  name: string,
  root: string = process.cwd(),
): SkillMeta | null {
  const local = findLocalSkillMd(root, name);
  if (local) return readMeta(local, "local");
  const installed = installedSkillMd(name);
  return installed ? readMeta(installed, "installed") : null;
}

/**
 * Resolve lint/fmt targets to `SKILL.md` paths. A target may be a `SKILL.md`
 * path, a directory containing one, or a skill name (resolved like
 * `findSkill`, but without reading the file). With no targets, every
 * `SKILL.md` under `root` is returned.
 *
 * @throws {Error} When a target cannot be resolved, or discovery finds nothing.
 */
export function resolveSkillMds(
  targets: string[],
  root: string = process.cwd(),
): string[] {
  if (targets.length === 0) return discoverSkillMds(root);

  let localSkillMds: Map<string, string> | null = null; // one walk serves every name target
  return targets.map((target) => {
    const stat = fs.statSync(target, { throwIfNoEntry: false });
    if (stat?.isDirectory()) {
      const candidate = path.join(target, "SKILL.md");
      if (fs.existsSync(candidate)) return candidate;
      throw new Error(`${target} does not contain a SKILL.md`);
    }
    if (stat?.isFile()) return target;
    localSkillMds ??= collectLocalSkillMds(root);
    const found = localSkillMds.get(target) ?? installedSkillMd(target);
    if (found) return found;
    throw new Error(
      `cannot resolve "${target}" — not a path, and no skill by that name in this repo or ~/.claude/skills`,
    );
  });
}

/**
 * Every `SKILL.md` under `root`, sorted.
 *
 * @throws {Error} When none are found.
 */
function discoverSkillMds(root: string): string[] {
  const found: string[] = [];
  for (const { path: filePath, entry } of skillWalk(root)) {
    if (entry.isFile() && entry.name === "SKILL.md") found.push(filePath);
  }
  if (found.length === 0) {
    throw new Error("no SKILL.md found under the current directory");
  }
  return found.sort();
}

/**
 * Every local skill's `SKILL.md`, keyed by directory name. First hit in walk
 * order wins, matching `findLocalSkillMd`.
 */
function collectLocalSkillMds(root: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const { path: dirPath, entry } of skillWalk(root)) {
    if (!entry.isDirectory() || map.has(entry.name)) continue;
    const candidate = path.join(dirPath, "SKILL.md");
    if (fs.existsSync(candidate)) map.set(entry.name, candidate);
  }
  return map;
}

/** Find the `SKILL.md` of the first directory named `name` under `root`. */
function findLocalSkillMd(root: string, name: string): string | null {
  for (const { path: dirPath, entry } of skillWalk(root)) {
    if (!entry.isDirectory() || entry.name !== name) continue;
    const candidate = path.join(dirPath, "SKILL.md");
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** The walk every skill lookup uses. */
function skillWalk(root: string): Generator<WalkEntry> {
  return walkDir(root, { skip: WALK_SKIP_DIRS, maxDepth: MAX_WALK_DEPTH });
}

/** The installed `SKILL.md` for `name`, if any. */
function installedSkillMd(name: string): string | null {
  const candidate = path.join(
    os.homedir(),
    ".claude",
    "skills",
    name,
    "SKILL.md",
  );
  return fs.existsSync(candidate) ? candidate : null;
}

/** Read the frontmatter fields the scaffolder uses. */
function readMeta(
  skillMdPath: string,
  source: "local" | "installed",
): SkillMeta {
  const raw = fs.readFileSync(skillMdPath, "utf8");
  let name = path.basename(path.dirname(skillMdPath));
  let description = "";
  let body = raw;

  const block = splitFrontmatter(raw);
  if (block) {
    // On parse failure, keep the folder-name fallback.
    const { data } = parseFrontmatter(block.yaml);
    if (typeof data?.name === "string") name = data.name;
    if (typeof data?.description === "string") description = data.description;
    body = block.body;
  }

  const triggers = extractTriggers(description, body);
  return {
    path: skillMdPath,
    source,
    name,
    description,
    ...(triggers ? { triggers } : {}),
  };
}

/**
 * A skill's trigger-keyword line, verbatim, if it declares one. Real skills
 * put it in the description or the body, behind a localized marker — so scan
 * both, strip markdown emphasis, and accept "Triggers", the Korean "트리거",
 * and the Japanese "トリガー". Returns the first list found (a hint, not a
 * contract).
 */
function extractTriggers(
  description: string,
  body: string,
): string | undefined {
  const text = `${description}\n${body}`.replace(/[*_#>]/g, "");
  const match = text.match(
    /(?:triggers?|트리거(?:\s*키워드)?|トリガー)\s*[:：—–-]\s*(.+)/i,
  );
  return match?.[1]?.trim() || undefined;
}
