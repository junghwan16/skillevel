/**
 * The `bench` command: run each benchable case with and without the skill,
 * grade both outputs, report the lift.
 */

import { benchSuites } from "../core/bench-runner.js";
import { summarizeBench } from "../core/summary.js";
import { renderBench, renderBenchSummary } from "../report/render.js";
import type { CommandContext } from "./context.js";
import { loadSuitesOrReport, reportError, writeJson } from "./helpers.js";

export interface BenchCommandOptions {
  filter?: string;
  concurrency?: number;
  model?: string;
  trials?: number;
  json?: string;
  /** Exit non-zero when overall lift is below this many percentage points. */
  minLift?: number;
}

/** Returns the process exit code. */
export async function benchCommand(
  target: string | undefined,
  options: BenchCommandOptions,
  ctx: CommandContext,
): Promise<number> {
  const suites = loadSuitesOrReport(ctx.io, target, options.filter);
  if (!suites) return 0;

  let results;
  try {
    results = await ctx.withProgress((onProgress) =>
      benchSuites(suites, ctx.runner, {
        trials: options.trials,
        concurrency: options.concurrency,
        model: options.model,
        onProgress,
      }),
    );
  } catch (error) {
    return reportError(ctx.io, error);
  }

  ctx.io.out(renderBench(results));
  const summary = summarizeBench(results);
  ctx.io.out(renderBenchSummary(summary));
  writeJson(ctx.io, options.json, results);

  const minLift = options.minLift;
  const failed =
    minLift !== undefined &&
    (summary.benched === 0 || summary.liftPp < minLift);
  return failed ? 1 : 0;
}
