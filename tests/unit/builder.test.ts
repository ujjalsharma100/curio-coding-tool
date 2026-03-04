import { afterEach, describe, expect, it } from "vitest";
import type { CliRuntimeConfig } from "../../src/cli/args.js";
import { buildAgent } from "../../src/agent/builder.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("Phase 1 agent builder", () => {
  it("builds an Agent with resolved provider + context metadata", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";

    const config: CliRuntimeConfig = {
      interactive: false,
      print: false,
      memoryEnabled: true,
      continueLastSession: false,
      model: "sonnet",
      provider: undefined,
      prompt: "hello",
      stdinInput: undefined,
      permissionMode: "ask",
      resumeSessionId: undefined,
      verbose: false,
      maxTurns: 7,
    };

    const result = await buildAgent(config);

    expect(result.agent).toBeDefined();
    expect(result.model).toBe("anthropic:claude-sonnet-4-6");
    expect(result.providerName).toBe("anthropic");
    expect(result.providerDisplayName).toBe("Anthropic");
    expect(result.modelDisplayName).toBe("claude-sonnet-4-6");
    expect(result.contextBudgetLabel).toContain("tokens");
  });
});

