/**
 * @file A single depth-first directory walker, shared by file discovery and
 * skill resolution so the "walk the tree, skip junk dirs" logic lives once.
 */

import fs from "node:fs";
import path from "node:path";

/**
 * @typedef {object} WalkOptions
 * @property {Set<string>} [skip]        Directory names not to descend into.
 * @property {number} [maxDepth]         Deepest level to descend (root entries are depth 0).
 * @property {boolean} [skipDotDirs]     Whether to skip descending into dot-directories.
 */

/**
 * Yield every entry under `root`, depth-first. Unreadable directories are
 * skipped silently. Callers filter for the files/directories they care about
 * and may stop early — the generator cleans up.
 *
 * @param {string} root
 * @param {WalkOptions} [options]
 * @returns {Generator<{ path: string, entry: fs.Dirent, depth: number }>}
 */
export function* walkDir(
  root,
  { skip = new Set(), maxDepth = Infinity, skipDotDirs = false } = {},
) {
  yield* walkFrom(root, 0, skip, maxDepth, skipDotDirs);
}

/**
 * @param {string} dir
 * @param {number} depth
 * @param {Set<string>} skip
 * @param {number} maxDepth
 * @param {boolean} skipDotDirs
 * @returns {Generator<{ path: string, entry: fs.Dirent, depth: number }>}
 */
function* walkFrom(dir, depth, skip, maxDepth, skipDotDirs) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // unreadable directory — skip
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    yield { path: full, entry, depth };
    if (!entry.isDirectory()) continue;
    const blocked =
      skip.has(entry.name) || (skipDotDirs && entry.name.startsWith("."));
    if (!blocked && depth < maxDepth)
      yield* walkFrom(full, depth + 1, skip, maxDepth, skipDotDirs);
  }
}
