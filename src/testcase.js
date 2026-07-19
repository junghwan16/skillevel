/**
 * @file Pure facts about a single test case. Kept in one module so the loader,
 * runner, and anything else classify a case the same way.
 */

/**
 * Whether a case is still an unwritten placeholder — its prompt contains a
 * `<...>` marker left by the `init` scaffold.
 *
 * @param {import('./types.js').TestCase} testCase
 * @returns {boolean}
 */
export function isUnwritten(testCase) {
  return /<[^>]+>/.test(testCase.prompt);
}

/**
 * Whether a case has output assertions (`match` / `absent` / `judge`) beyond the
 * trigger check. When it does, a run must complete instead of early-exiting on
 * the trigger verdict.
 *
 * @param {import('./types.js').TestCase} testCase
 * @returns {boolean}
 */
export function hasOutputChecks(testCase) {
  return (testCase.expect ?? []).some(
    (expectation) => typeof expectation === "object",
  );
}
