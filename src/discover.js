/**
 * @file Finds eval files on disk.
 */

import fs from "node:fs";
import path from "node:path";
import { walkDir } from "./fswalk.js";

/** Directories never worth descending into. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  "coverage",
]);

/**
 * Whether a file is an eval file: `*.eval.yaml` / `*.eval.yml`, or an
 * `evals/cases.yaml`.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
function isEvalFile(filePath) {
  const name = path.basename(filePath);
  if (/\.eval\.ya?ml$/.test(name)) return true;
  return (
    name === "cases.yaml" && path.basename(path.dirname(filePath)) === "evals"
  );
}

/**
 * Discover eval files under `root`. If `root` is itself a file, it is returned
 * as the only entry.
 *
 * @param {string} [root]
 * @returns {string[]} Sorted paths.
 */
export function discover(root = process.cwd()) {
  if (fs.statSync(root, { throwIfNoEntry: false })?.isFile()) return [root];

  const found = [];
  for (const { path: filePath, entry } of walkDir(root, {
    skip: SKIP_DIRS,
    skipDotDirs: true,
  })) {
    if (!entry.isDirectory() && isEvalFile(filePath)) found.push(filePath);
  }
  return found.sort();
}
