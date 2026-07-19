/**
 * Pure interpretation of the `claude -p --output-format stream-json` NDJSON
 * stream. No process handling here — the adapter feeds lines in and reads the
 * outcome out, so the stream schema is testable without spawning anything.
 *
 * The stream schema (verified on Claude Code 2.1.x): assistant messages carry
 * a `message.content[]` array; a `tool_use` block named `"Skill"` holds the
 * fired skill in `input.skill`. The terminating `result` event carries
 * `result` (text), `total_cost_usd`, `num_turns`, and `is_error`.
 */

type StreamEvent = Record<string, unknown>;

/** Parse one NDJSON line, tolerating non-JSON noise. */
export function parseStreamLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as StreamEvent)
      : null;
  } catch {
    return null;
  }
}

/**
 * Accumulates stream events into the fields of a {@link RunOutcome}. The
 * adapter owns process-level facts (stopped early, timed out); this collector
 * owns everything observable in the stream itself.
 */
export class OutcomeCollector {
  readonly skillsFired = new Set<string>();
  readonly toolsUsed = new Set<string>();
  text = "";
  costUsd = 0;
  numTurns = 0;
  isError = false;

  /**
   * Ingest one event. Returns the skills newly seen in it, so the caller can
   * apply its early-stop policy.
   */
  ingest(event: StreamEvent): string[] {
    const skills = this.collectToolUses(event);
    for (const skill of skills) this.skillsFired.add(skill);
    if (event.type === "result") {
      if (typeof event.result === "string") this.text = event.result;
      if (typeof event.total_cost_usd === "number")
        this.costUsd = event.total_cost_usd;
      if (typeof event.num_turns === "number") this.numTurns = event.num_turns;
      this.isError = Boolean(event.is_error);
    }
    return skills;
  }

  /** Record every tool name in the event; return the skill names fired. */
  private collectToolUses(event: StreamEvent): string[] {
    const message = event.message ?? event;
    const content = (message as { content?: unknown }).content;
    if (!Array.isArray(content)) return [];
    const skills: string[] = [];
    for (const block of content as Array<Record<string, unknown> | null>) {
      if (block?.type !== "tool_use") continue;
      if (typeof block.name === "string" && block.name)
        this.toolsUsed.add(block.name);
      if (block.name !== "Skill") continue;
      const input = (block.input ?? {}) as Record<string, unknown>;
      const raw = input.skill ?? input.skill_name ?? input.command ?? "";
      const skill = String(raw).replace(/^\//, "");
      if (skill) skills.push(skill);
    }
    return skills;
  }
}
