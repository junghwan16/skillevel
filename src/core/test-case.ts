/**
 * Pure facts about a single test case. Kept in one module so the loader,
 * runner, and anything else classify a case the same way.
 */

import { isOutputCheck, type TestCase } from "./types.js";

/**
 * Whether a case is still an unwritten placeholder — its prompt contains a
 * `<...>` marker left by the `new` scaffold.
 */
export function isUnwritten(testCase: TestCase): boolean {
  return /<[^>]+>/.test(testCase.prompt);
}

/**
 * Whether a case has output assertions (`match` / `absent` / `judge`) beyond
 * the trigger check. When it does, a run must complete instead of
 * early-exiting on the trigger verdict.
 */
export function hasOutputChecks(testCase: TestCase): boolean {
  return (testCase.expect ?? []).some(isOutputCheck);
}

/**
 * Whether a case qualifies for `bench`: a happy case carrying output checks.
 * A trigger-only case has nothing to compare, and a "must not fire" case is
 * identical in both arms.
 */
export function isBenchable(testCase: TestCase): boolean {
  return testCase.should_trigger && hasOutputChecks(testCase);
}
