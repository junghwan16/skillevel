/**
 * The default command: discover, run, report.
 */

import { runSuites } from "../core/eval-runner.js";
import { summarize } from "../core/summary.js";
import { renderGrid, renderSummary } from "../report/render.js";
import type { CommandContext } from "./context.js";
import { loadSuitesOrReport, reportError, writeJson } from "./helpers.js";

export interface RunCommandOptions {
  filter?: string;
  concurrency?: number;
  threshold?: number;
  model?: string;
  trials?: number;
  json?: string;
  ci?: boolean;
}

/** Returns the process exit code. */
export async function runCommand(
  target: string | undefined,
  options: RunCommandOptions,
  ctx: CommandContext,
): Promise<number> {
  const suites = loadSuitesOrReport(ctx.io, target, options.filter);
  if (!suites) return options.ci ? 1 : 0;

  let results;
  try {
    results = await ctx.withProgress((onProgress) =>
      runSuites(suites, ctx.runner, {
        concurrency: options.concurrency,
        threshold: options.threshold,
        model: options.model,
        trials: options.trials,
        onProgress,
      }),
    );
  } catch (error) {
    return reportError(ctx.io, error);
  }

  ctx.io.out(renderGrid(results));
  const summary = summarize(results);
  ctx.io.out(renderSummary(summary));
  writeJson(ctx.io, options.json, results);

  const failed = summary.fail > 0 || (Boolean(options.ci) && summary.todo > 0);
  return failed ? 1 : 0;
}
