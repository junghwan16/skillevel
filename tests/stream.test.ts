import { describe, expect, it } from "vitest";
import { OutcomeCollector, parseStreamLine } from "../src/agent/stream.js";

describe("parseStreamLine", () => {
  it("parses a JSON object line", () => {
    expect(parseStreamLine('{"type":"result"}')).toEqual({ type: "result" });
  });

  it("tolerates blank lines and non-JSON noise", () => {
    expect(parseStreamLine("")).toBeNull();
    expect(parseStreamLine("   ")).toBeNull();
    expect(parseStreamLine("warning: something")).toBeNull();
    expect(parseStreamLine("42")).toBeNull(); // JSON, but not an event object
  });
});

describe("OutcomeCollector", () => {
  it("extracts fired skills from Skill tool_use blocks", () => {
    const collector = new OutcomeCollector();
    const fired = collector.ingest({
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", name: "Read", input: {} },
          { type: "tool_use", name: "Skill", input: { skill: "commit-style" } },
        ],
      },
    });
    expect(fired).toEqual(["commit-style"]);
    expect([...collector.skillsFired]).toEqual(["commit-style"]);
    expect([...collector.toolsUsed]).toEqual(["Read", "Skill"]);
  });

  it("accepts the alternate skill input keys and strips a leading slash", () => {
    const collector = new OutcomeCollector();
    const skillOf = (input: Record<string, unknown>) =>
      collector.ingest({
        message: { content: [{ type: "tool_use", name: "Skill", input }] },
      });
    expect(skillOf({ skill_name: "a" })).toEqual(["a"]);
    expect(skillOf({ command: "/b" })).toEqual(["b"]);
    expect(skillOf({})).toEqual([]); // no recognisable name — not a firing
  });

  it("captures the terminating result event", () => {
    const collector = new OutcomeCollector();
    collector.ingest({
      type: "result",
      result: "final text",
      total_cost_usd: 0.12,
      num_turns: 3,
      is_error: false,
    });
    expect(collector.text).toBe("final text");
    expect(collector.costUsd).toBe(0.12);
    expect(collector.numTurns).toBe(3);
    expect(collector.isError).toBe(false);
  });

  it("ignores events without a content array", () => {
    const collector = new OutcomeCollector();
    expect(collector.ingest({ type: "system" })).toEqual([]);
    expect(collector.ingest({ message: { content: "text" } })).toEqual([]);
  });
});
