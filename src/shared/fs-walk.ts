/**
 * A single depth-first directory walker, shared by file discovery and skill
 * resolution so the "walk the tree, skip junk dirs" logic lives once.
 */

import fs from "node:fs";
import path from "node:path";

export interface WalkOptions {
  /** Directory names not to descend into. */
  skip?: ReadonlySet<string>;
  /** Deepest level to descend (root entries are depth 0). */
  maxDepth?: number;
  /** Whether to skip descending into dot-directories. */
  skipDotDirs?: boolean;
}

export interface WalkEntry {
  path: string;
  entry: fs.Dirent;
  depth: number;
}

/**
 * Yield every entry under `root`, depth-first. Unreadable directories are
 * skipped silently. Callers filter for the files/directories they care about
 * and may stop early — the generator cleans up.
 */
export function* walkDir(
  root: string,
  {
    skip = new Set(),
    maxDepth = Infinity,
    skipDotDirs = false,
  }: WalkOptions = {},
): Generator<WalkEntry> {
  yield* walkFrom(root, 0, skip, maxDepth, skipDotDirs);
}

function* walkFrom(
  dir: string,
  depth: number,
  skip: ReadonlySet<string>,
  maxDepth: number,
  skipDotDirs: boolean,
): Generator<WalkEntry> {
  let entries: fs.Dirent[];
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
