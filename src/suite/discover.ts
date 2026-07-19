/**
 * Finds eval files on disk.
 */

import fs from "node:fs";
import path from "node:path";
import { WALK_SKIP_DIRS } from "../core/constants.js";
import { walkDir } from "../shared/fs-walk.js";

/**
 * Whether a file is an eval file: `*.eval.yaml` / `*.eval.yml`, or an
 * `evals/cases.yaml`.
 */
function isEvalFile(filePath: string): boolean {
  const name = path.basename(filePath);
  if (/\.eval\.ya?ml$/.test(name)) return true;
  return (
    name === "cases.yaml" && path.basename(path.dirname(filePath)) === "evals"
  );
}

/**
 * Discover eval files under `root`. If `root` is itself a file, it is
 * returned as the only entry. Sorted paths.
 */
export function discover(root: string = process.cwd()): string[] {
  if (fs.statSync(root, { throwIfNoEntry: false })?.isFile()) return [root];

  const found: string[] = [];
  for (const { path: filePath, entry } of walkDir(root, {
    skip: WALK_SKIP_DIRS,
    skipDotDirs: true,
  })) {
    if (!entry.isDirectory() && isEvalFile(filePath)) found.push(filePath);
  }
  return found.sort();
}
