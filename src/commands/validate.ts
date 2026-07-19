/**
 * The `validate` command: parse suites offline, surface schema errors, and
 * preview how many `claude` runs an eval / bench would cost — the cheap
 * pre-flight before spending on a real run.
 */

import pc from "picocolors";
import { DEFAULT_TRIALS } from "../core/constants.js";
import { isBenchable, isUnwritten } from "../core/test-case.js";
import { collectSuites } from "../suite/load.js";
import type { CommandContext } from "./context.js";

export interface ValidateCommandOptions {
  filter?: string;
}

/** Returns the process exit code. */
export function validateCommand(
  target: string | undefined,
  options: ValidateCommandOptions,
  ctx: CommandContext,
): number {
  const { io } = ctx;
  const { suites, skipped, filteredOut } = collectSuites(
    target,
    options.filter,
  );
  for (const { file, error } of skipped) {
    io.err(`${pc.red("✗")} ${file}\n  ${pc.red(error.message)}`);
  }
  let evalRuns = 0;
  let benchRuns = 0;
  for (const suite of suites) {
    const counts = { happy: 0, negative: 0, routing: 0, todo: 0 };
    for (const testCase of suite.cases) {
      if (isUnwritten(testCase)) {
        counts.todo += 1;
        continue;
      }
      const trials = testCase.trials ?? suite.trials ?? DEFAULT_TRIALS;
      evalRuns += trials;
      if (testCase.expect_skill !== undefined) counts.routing += 1;
      else if (testCase.should_trigger) counts.happy += 1;
      else counts.negative += 1;
      // Benchable = happy case carrying an output check; both arms run.
      if (isBenchable(testCase)) benchRuns += trials * 2;
    }
    const parts = [
      `${counts.happy} happy`,
      `${counts.negative} negative`,
      counts.routing ? `${counts.routing} routing` : null,
      counts.todo ? pc.yellow(`${counts.todo} todo`) : null,
    ].filter(Boolean);
    io.out(
      `${pc.green("✓")} ${pc.bold(suite.skill)} ${pc.dim(suite.file ?? "")}\n  ${parts.join(pc.dim(" · "))}`,
    );
  }
  if (filteredOut.length > 0) {
    io.err(
      pc.yellow(
        `\n${filteredOut.length} suite(s) had no case matching filter "${options.filter}"`,
      ),
    );
  }
  if (suites.length > 0) {
    io.out(
      pc.dim(
        `\n≈ ${evalRuns} claude run(s) for a full eval` +
          (benchRuns
            ? `, ≈ ${benchRuns} for \`bench\` (both arms + graders)`
            : "") +
          " — trigger-only cases exit early, so real spend is lower.",
      ),
    );
  } else if (skipped.length === 0 && filteredOut.length === 0) {
    io.err(pc.yellow("no eval suites found"));
  }
  return skipped.length > 0 ? 1 : 0;
}
