/**
 * What every command needs from the outside world, injected so commands are
 * plain functions: parse input → do work → write lines → return an exit
 * code. The CLI entry point supplies the real console, agent runner, and
 * progress line; tests supply in-memory fakes.
 */

import type { AgentRunner } from "../agent/agent-runner.js";
import type { ProgressFn } from "../shared/pool.js";

/** Line-oriented output sinks (stdout / stderr). */
export interface CommandIo {
  out(line: string): void;
  err(line: string): void;
}

/**
 * Wrap a long-running batch so the host can show progress and clean it up
 * afterwards (the CLI draws a `running n/m…` line on a TTY; tests use a
 * pass-through).
 */
export type ProgressScope = <T>(
  run: (onProgress: ProgressFn) => Promise<T>,
) => Promise<T>;

export interface CommandContext {
  io: CommandIo;
  runner: AgentRunner;
  withProgress: ProgressScope;
}

/** The pass-through progress scope: no feedback, no cleanup. */
export const noProgress: ProgressScope = (run) => run(() => {});
