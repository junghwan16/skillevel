/**
 * @file Locates a skill's `SKILL.md` and reads the bits `init` needs. A working
 * copy under the current directory wins over the installed one.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "yaml";
import { walkDir } from "./fswalk.js";

/**
 * @typedef {object} SkillMeta
 * @property {string} path                   Path to the `SKILL.md`.
 * @property {"local" | "installed"} source
 * @property {string} name                   Frontmatter `name`, or the folder name.
 * @property {string} description            Frontmatter `description`.
 * @property {string} [triggers]             Verbatim trigger-keyword line, if any.
 */

const MAX_WALK_DEPTH = 6;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist"]);

/**
 * Find a skill's `SKILL.md`. Prefers a working copy under `root`; falls back to
 * `~/.claude/skills/<name>/SKILL.md`.
 *
 * @param {string} name
 * @param {string} [root]
 * @returns {SkillMeta | null}
 */
export function findSkill(name, root = process.cwd()) {
  const local = findLocalSkillMd(root, name);
  if (local) return readMeta(local, "local");

  const installed = path.join(
    os.homedir(),
    ".claude",
    "skills",
    name,
    "SKILL.md",
  );
  return fs.existsSync(installed) ? readMeta(installed, "installed") : null;
}

/**
 * Find the `SKILL.md` of the first directory named `name` under `root`.
 *
 * @param {string} root
 * @param {string} name
 * @returns {string | null}
 */
function findLocalSkillMd(root, name) {
  for (const { path: dirPath, entry } of walkDir(root, {
    skip: SKIP_DIRS,
    maxDepth: MAX_WALK_DEPTH,
  })) {
    if (!entry.isDirectory() || entry.name !== name) continue;
    const candidate = path.join(dirPath, "SKILL.md");
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Read the frontmatter fields `init` uses.
 *
 * @param {string} skillMdPath
 * @param {"local" | "installed"} source
 * @returns {SkillMeta}
 */
function readMeta(skillMdPath, source) {
  const raw = fs.readFileSync(skillMdPath, "utf8");
  let name = path.basename(path.dirname(skillMdPath));
  let description = "";

  const frontmatter = raw.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatter) {
    try {
      /** @type {{ name?: string, description?: string }} */
      const data = parse(frontmatter[1]);
      name = data.name ?? name;
      description = data.description ?? "";
    } catch {
      // frontmatter isn't strict YAML — keep the folder-name fallback
    }
  }

  const triggers = description
    .match(/(?:triggers?)\s*[:—-]\s*(.+)/i)?.[1]
    ?.trim();
  return { path: skillMdPath, source, name, description, triggers };
}
