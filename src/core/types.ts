/**
 * Shared domain types: what a suite/case is, what a run observes, and how
 * results are shaped. No runtime code beyond tiny type guards.
 */

/**
 * A single assertion in a case's `expect` list.
 *
 * - `"triggered"` / `"not_triggered"` — shorthands validated against
 *   `should_trigger`; the real trigger check is always derived from that field.
 * - `{ match }` — a case-insensitive regex that must appear in the response.
 * - `{ absent }` — a regex that must NOT appear in the response.
 * - `{ judge }` — a rubric question answered PASS/FAIL by a fresh LLM judge.
 */
export type Expectation = TriggerShorthand | OutputCheck;

export type TriggerShorthand = "triggered" | "not_triggered";

export type OutputCheck =
  { match: string } | { absent: string } | { judge: string };

/** Output checks are the object-shaped expectations; shorthands are strings. */
export function isOutputCheck(
  expectation: Expectation,
): expectation is OutputCheck {
  return typeof expectation === "object";
}

/**
 * One test case: a prompt plus the behaviour expected of the skill.
 *
 * A case declares its trigger expectation in one of two ways:
 * - `should_trigger: true|false` — should the target skill fire?
 * - `expect_skill: <name>|none` — which skill should win the routing? The
 *   suite's own skill (≡ `should_trigger: true`), a sibling (the sibling must
 *   fire and the target must stay out — a collision case), or `none` (no skill
 *   at all may fire). The loader derives `should_trigger` from it.
 */
export interface TestCase {
  /** Unique within the suite. */
  id: string;
  /** What the user would type. An unfilled `<placeholder>` marks the case as unwritten. */
  prompt: string;
  /** Whether the target skill should fire. */
  should_trigger: boolean;
  /** The skill that should win, or "none". */
  expect_skill?: string;
  /** Per-case override of the suite's trials. */
  trials?: number;
  /** Working dir for this case's runs (see Suite.cwd). */
  cwd?: string;
  /** Extra assertions beyond the trigger check. */
  expect?: Expectation[];
}

/** A cases file (the community `evals/cases.yaml` schema). */
export interface Suite {
  /** Leaf skill name; must match the Skill tool's name. */
  skill: string;
  cases: TestCase[];
  /** Default trials per case. */
  trials?: number;
  /** Model passed to `claude --model`. */
  model?: string;
  /** Green pass-rate threshold (0..1). */
  triggerThreshold?: number;
  /**
   * Working dir for runs, relative to the eval file. Repo-context skills only
   * trigger where there's something to act on (a diff, a failing test).
   */
  cwd?: string;
  /** Source path; filled in by the loader. */
  file?: string;
}

/** The observable result of a single `claude -p` run. */
export interface RunOutcome {
  /** Final assistant text. */
  text: string;
  /** Distinct skills invoked, in order seen. */
  skillsFired: string[];
  /** Distinct tool names invoked. */
  toolsUsed: string[];
  /** Reported cost of the run (0 when stopped early). */
  costUsd: number;
  numTurns: number;
  /** True when killed on the trigger verdict, before the cost event. */
  stoppedEarly: boolean;
  /** True only for genuine failures (not early stops). */
  isError: boolean;
}

/** The outcome of evaluating one assertion. */
export interface CheckResult {
  label: string;
  ok: boolean;
  /** Why it failed, when it did. */
  detail?: string;
}

/** One trial of a case: the run plus its checks. */
export interface TrialResult {
  outcome: RunOutcome;
  checks: CheckResult[];
  /** True when every check passed. */
  pass: boolean;
}

/** `"todo"` means the case is an unwritten placeholder. */
export type CaseStatus = "pass" | "fail" | "todo";

/** Aggregated result for one case across its trials. */
export interface CaseResult {
  id: string;
  skill: string;
  status: CaseStatus;
  /** Fraction of trials that passed (0..1). */
  passRate: number;
  /** Number of trials that passed. */
  passed: number;
  trials: TrialResult[];
  costUsd: number;
}

/** Aggregated result for one suite. */
export interface SuiteResult {
  skill: string;
  file: string;
  /** Green pass-rate threshold for this suite. */
  threshold: number;
  cases: CaseResult[];
}
