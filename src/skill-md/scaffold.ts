/**
 * Writes the scaffold files the `new` command creates: a starter `SKILL.md`
 * and a starter cases file. Template content lives in `templates.ts`; this
 * module only owns the fs side.
 */

import fs from "node:fs";
import path from "node:path";
import { findSkill } from "../suite/resolve.js";
import { skillNameProblems } from "./document.js";
import { renderSkillTemplate, renderSuiteTemplate } from "./templates.js";

/**
 * Create `<dir>/<skill>/SKILL.md` from the starter template.
 *
 * @throws {Error} When the name is invalid or the `SKILL.md` already exists.
 */
export function newSkill(
  skill: string,
  dir?: string,
): { dir: string; file: string } {
  // Same grammar `lint` enforces — better to fail here than after writing.
  const nameProblems = skillNameProblems(skill);
  if (nameProblems.length > 0) {
    throw new Error(nameProblems.map((problem) => problem.message).join("; "));
  }

  const skillDir = path.join(dir ?? ".", skill);
  const file = path.join(skillDir, "SKILL.md");
  if (fs.existsSync(file)) throw new Error(`${file} already exists`);

  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(file, renderSkillTemplate(skill));
  return { dir: skillDir, file };
}

/**
 * Write a starter cases file for `skill` (default `<skill>.eval.yaml`),
 * echoing the skill's own trigger keywords when its `SKILL.md` can be found.
 *
 * @throws {Error} When the target file already exists.
 */
export function initSuite(
  skill: string,
  outFile?: string,
): { file: string; source: string } {
  const meta = findSkill(skill);
  const file = outFile ?? `${skill}.eval.yaml`;

  const dir = path.dirname(file);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(file)) throw new Error(`${file} already exists`);

  fs.writeFileSync(file, renderSuiteTemplate(skill, meta));
  return { file, source: meta ? `${meta.source}: ${meta.path}` : "not found" };
}
