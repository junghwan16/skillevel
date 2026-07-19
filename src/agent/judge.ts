/**
 * The LLM judge: asks a fresh Claude (no skills, one turn) to grade a
 * response against a rubric. Built on the {@link AgentRunner} port so tests
 * can fake the model.
 */

import { DEFAULT_JUDGE_MODEL, JUDGE_TIMEOUT_MS } from "../core/constants.js";
import type { AgentRunner } from "./agent-runner.js";

export interface Verdict {
  ok: boolean;
  reason: string;
}

/** Grades an answer against a rubric question. */
export type Judge = (question: string, answer: string) => Promise<Verdict>;

/** How much of the answer the judge gets to see. */
const MAX_ANSWER_CHARS = 6000;
const MAX_REASON_CHARS = 140;

/** Build a {@link Judge} that runs the rubric through `runner`. */
export function createJudge(runner: AgentRunner, model?: string): Judge {
  return async (question, answer) => {
    const prompt = [
      "You are grading an AI assistant's response against a criterion.",
      `Criterion: ${question}`,
      "",
      "--- RESPONSE ---",
      answer.slice(0, MAX_ANSWER_CHARS),
      "--- END ---",
      "",
      'Reply with exactly "PASS" or "FAIL" as the first word, then a one-line reason.',
    ].join("\n");

    const outcome = await runner.run(prompt, {
      model: model ?? DEFAULT_JUDGE_MODEL,
      maxTurns: 1,
      timeoutMs: JUDGE_TIMEOUT_MS,
    });
    return {
      ok: /^\s*pass\b/i.test(outcome.text),
      reason: outcome.text
        .split("\n")
        .slice(1)
        .join(" ")
        .trim()
        .slice(0, MAX_REASON_CHARS),
    };
  };
}
