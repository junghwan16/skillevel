/**
 * The `fmt` command.
 */

import fs from "node:fs";
import pc from "picocolors";
import { formatSkillMd } from "../skill-md/format.js";
import { resolveSkillMds } from "../suite/resolve.js";
import type { CommandContext } from "./context.js";
import { countFiles, reportError } from "./helpers.js";

export interface FmtCommandOptions {
  /** Report files that would change, without writing. */
  check?: boolean;
}

/** Returns the process exit code. */
export function fmtCommand(
  targets: string[],
  options: FmtCommandOptions,
  ctx: CommandContext,
): number {
  const { io } = ctx;
  let files: string[];
  try {
    files = resolveSkillMds(targets);
  } catch (error) {
    return reportError(io, error);
  }

  let changed = 0;
  let unreadable = 0;
  for (const file of files) {
    let source: string;
    try {
      source = fs.readFileSync(file, "utf8");
    } catch (error) {
      io.err(pc.red(`cannot read ${file}: ${(error as Error).message}`));
      unreadable += 1;
      continue;
    }
    const formatted = formatSkillMd(source);
    if (formatted === source) continue; // untouched — no mtime churn
    changed += 1;
    if (options.check) {
      io.out(pc.yellow(`would format ${file}`));
    } else {
      fs.writeFileSync(file, formatted);
      io.out(pc.green(`formatted ${file}`));
    }
  }
  if (changed === 0 && unreadable === 0) {
    io.out(pc.dim(`${countFiles(files.length)} already formatted`));
  }
  return unreadable > 0 || (Boolean(options.check) && changed > 0) ? 1 : 0;
}
