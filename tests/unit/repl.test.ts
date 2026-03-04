import { afterEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "curio-agent-sdk";
import { runOneShotMode } from "../../src/cli/repl.js";

function createFakeAgent(events: unknown[]): Agent {
  return {
    astream: async function* () {
      for (const event of events) {
        yield event;
      }
    },
  } as unknown as Agent;
}

describe("Phase 1 REPL one-shot", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  afterEach(() => {
    stdoutSpy.mockClear();
    stderrSpy.mockClear();
  });

  it("prints only text deltas in print mode", async () => {
    const fakeAgent = createFakeAgent([
      { type: "text_delta", text: "Hello" },
      { type: "thinking", text: "thinking..." },
      {
        type: "done",
        result: {
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          duration: 10,
          iterations: 1,
        },
      },
    ]);

    await runOneShotMode(fakeAgent, "prompt", true);

    const stdout = stdoutSpy.mock.calls.map((call) => String(call[0])).join("");
    const stderr = stderrSpy.mock.calls.map((call) => String(call[0])).join("");

    expect(stdout).toContain("Hello");
    expect(stdout).not.toContain("[thinking]");
    expect(stderr).toBe("");
  });

  it("renders metrics in non-print mode", async () => {
    const fakeAgent = createFakeAgent([
      { type: "text_delta", text: "Hi" },
      {
        type: "done",
        result: {
          usage: { promptTokens: 3, completionTokens: 4, totalTokens: 7 },
          duration: 1200,
          iterations: 2,
        },
      },
    ]);

    await runOneShotMode(fakeAgent, "prompt", false);

    const stderr = stderrSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(stderr).toContain("Tokens: 3 in / 4 out");
    expect(stderr).toContain("Duration: 1.2s");
    expect(stderr).toContain("Turns: 2");
  });
});

