/**
 * The `lint` command.
 */

import pc from "picocolors";
import { lintSkillMd } from "../skill-md/lint.js";
import { resolveSkillMds } from "../suite/resolve.js";
import type { CommandContext } from "./context.js";
import { countFiles, reportError } from "./helpers.js";

/** Returns the process exit code. */
export function lintCommand(targets: string[], ctx: CommandContext): number {
  const { io } = ctx;
  let files: string[];
  try {
    files = resolveSkillMds(targets);
  } catch (error) {
    return reportError(io, error);
  }

  let errors = 0;
  let warnings = 0;
  for (const file of files) {
    const { problems } = lintSkillMd(file);
    if (problems.length === 0) {
      io.out(`${pc.green("✓")} ${file}`);
      continue;
    }
    io.out(file);
    for (const { severity, rule, message } of problems) {
      const paint = severity === "error" ? pc.red : pc.yellow;
      io.out(`  ${paint(`${severity} ${rule}`)} — ${message}`);
      if (severity === "error") errors += 1;
      else warnings += 1;
    }
  }
  const parts = [
    countFiles(files.length),
    errors ? pc.red(`${errors} errors`) : pc.dim("0 errors"),
    warnings ? pc.yellow(`${warnings} warnings`) : pc.dim("0 warnings"),
  ];
  io.out(`\n${parts.join(pc.dim(" · "))}`);
  return errors > 0 ? 1 : 0;
}
