/**
 * Turns a run outcome into pass/fail checks for a case: the primary trigger
 * check plus any extra `expect` assertions. Pure except for the injected
 * {@link Judge}, so every branch is unit-testable.
 */

import type { Judge } from "../agent/judge.js";
import {
  isOutputCheck,
  type CheckResult,
  type OutputCheck,
  type RunOutcome,
  type TestCase,
} from "./types.js";

/** Evaluate one trial of a case: the trigger check plus all output checks. */
export async function evaluateTrial(
  testCase: TestCase,
  skill: string,
  outcome: RunOutcome,
  judge: Judge,
): Promise<CheckResult[]> {
  const evaluated = await evaluateOutputChecks(testCase, outcome, judge);
  return [triggerCheck(testCase, skill, outcome), ...evaluated];
}

/**
 * Evaluate only a case's output checks (`match` / `absent` / `judge`) — no
 * trigger check. This is what `bench` grades on both arms; trigger shorthands
 * are strings and are skipped.
 */
export function evaluateOutputChecks(
  testCase: TestCase,
  outcome: RunOutcome,
  judge: Judge,
): Promise<CheckResult[]> {
  // the checks are independent, so evaluate them concurrently (a `judge`
  // check spawns a subprocess)
  const outputChecks = (testCase.expect ?? []).filter(isOutputCheck);
  return Promise.all(
    outputChecks.map((check) => evaluateOutputCheck(check, outcome, judge)),
  );
}

/**
 * The always-present check. With `should_trigger`, did the target skill fire
 * as declared? With `expect_skill`, did the routing go where it should — to
 * the named sibling (target staying out) or to no skill at all?
 */
export function triggerCheck(
  testCase: TestCase,
  skill: string,
  outcome: RunOutcome,
): CheckResult {
  const fired = outcome.skillsFired;
  const expected = testCase.expect_skill;
  let label: string;
  let ok: boolean;
  if (expected !== undefined && expected !== skill) {
    if (expected === "none") {
      label = "no skill fires";
      ok = fired.length === 0;
    } else {
      label = `routes to ${expected}`;
      ok = fired.includes(expected) && !fired.includes(skill);
    }
  } else {
    label = testCase.should_trigger
      ? `triggers ${skill}`
      : `stays out (${skill})`;
    ok = fired.includes(skill) === testCase.should_trigger;
  }
  return {
    label,
    ok,
    ...(ok ? {} : { detail: `fired: ${fired.join(", ") || "none"}` }),
  };
}

/** Evaluate a non-shorthand expectation against the response. */
async function evaluateOutputCheck(
  check: OutputCheck,
  outcome: RunOutcome,
  judge: Judge,
): Promise<CheckResult> {
  if ("match" in check) {
    return {
      label: `match /${check.match}/`,
      ok: toRegExp(check.match).test(outcome.text),
    };
  }
  if ("absent" in check) {
    return {
      label: `absent /${check.absent}/`,
      ok: !toRegExp(check.absent).test(outcome.text),
    };
  }
  const verdict = await judge(check.judge, outcome.text);
  return { label: "judge", ok: verdict.ok, detail: verdict.reason };
}

/**
 * Compile a case-insensitive regex, falling back to a literal substring match
 * when the pattern is not valid regex.
 */
function toRegExp(pattern: string): RegExp {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
}
