/**
 * Pure aggregation of run results — kept apart from rendering so the numbers
 * are testable without parsing terminal output.
 */

import type { BenchSuiteResult } from "./bench-runner.js";
import type { CaseStatus, SuiteResult } from "./types.js";

export interface Summary {
  pass: number;
  fail: number;
  todo: number;
  costUsd: number;
  /** Some trials stopped early, so the total is a lower bound. */
  costPartial: boolean;
}

/** Count outcomes across all suites. */
export function summarize(suites: SuiteResult[]): Summary {
  const cases = suites.flatMap((suite) => suite.cases);
  const count = (status: CaseStatus) =>
    cases.filter((c) => c.status === status).length;
  return {
    pass: count("pass"),
    fail: count("fail"),
    todo: count("todo"),
    costUsd: cases.reduce((total, c) => total + c.costUsd, 0),
    costPartial: cases.some((c) =>
      c.trials.some((trial) => trial.outcome.stoppedEarly),
    ),
  };
}

/** Aggregate pass-rates and lift across all benched cases. */
export interface BenchSummary {
  /** Cases actually A/B-run. */
  benched: number;
  skipped: number;
  todo: number;
  /** 0..1 across all benched trials. */
  withRate: number;
  withoutRate: number;
  /** (withRate - withoutRate) in percentage points. */
  liftPp: number;
  costUsd: number;
}

export function summarizeBench(suites: BenchSuiteResult[]): BenchSummary {
  const cases = suites.flatMap((suite) => suite.cases);
  const benched = cases.filter((c) => c.status === "done");
  const totalTrials = benched.reduce((sum, c) => sum + c.trials, 0);
  const withRate = totalTrials
    ? benched.reduce((sum, c) => sum + c.withPassed, 0) / totalTrials
    : 0;
  const withoutRate = totalTrials
    ? benched.reduce((sum, c) => sum + c.withoutPassed, 0) / totalTrials
    : 0;
  return {
    benched: benched.length,
    skipped: cases.filter((c) => c.status === "skipped").length,
    todo: cases.filter((c) => c.status === "todo").length,
    withRate,
    withoutRate,
    liftPp: Math.round((withRate - withoutRate) * 100),
    costUsd: cases.reduce((sum, c) => sum + c.costUsd, 0),
  };
}
