import { afterEach, describe, expect, it } from "vitest";
import {
  resolveDefaultModel,
  resolveModelAlias,
  resolveProvider,
  validateApiKeyFormat,
  validateProviderApiKey,
} from "../../src/agent/provider-config.js";

const ORIGINAL_ENV = { ...process.env };

function resetEnv(): void {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.OLLAMA_HOST;
}

afterEach(() => {
  resetEnv();
});

describe("Phase 1 provider config", () => {
  it("resolves known short model aliases", () => {
    expect(resolveModelAlias("sonnet")).toBe("anthropic:claude-sonnet-4-6");
    expect(resolveModelAlias("gpt4o")).toBe("openai:gpt-4o");
    expect(resolveModelAlias("haiku")).toBe("anthropic:claude-haiku-4-5");
    expect(resolveModelAlias("custom:model")).toBe("custom:model");
  });

  it("chooses default model by env priority", () => {
    process.env.OPENAI_API_KEY = "sk-test-openai";
    expect(resolveDefaultModel()).toBe("openai:gpt-4o");

    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(resolveDefaultModel()).toBe("anthropic:claude-sonnet-4-6");
  });

  it("throws a clear error when no provider env is configured", () => {
    expect(() => resolveDefaultModel()).toThrowError(/No LLM provider configured/);
  });

  it("validates provider api key presence", () => {
    expect(() => validateProviderApiKey("anthropic")).toThrowError(
      /ANTHROPIC_API_KEY is not set/,
    );

    process.env.ANTHROPIC_API_KEY = "sk-ant-present";
    expect(() => validateProviderApiKey("anthropic")).not.toThrow();
  });

  it("validates key format checks", () => {
    expect(validateApiKeyFormat("anthropic", "sk-ant-abc")).toBe(true);
    expect(validateApiKeyFormat("anthropic", "sk-abc")).toBe(false);
    expect(validateApiKeyFormat("openai", "sk-abc")).toBe(true);
    expect(validateApiKeyFormat("groq", "gsk_abc")).toBe(true);
  });

  it("resolves provider/model metadata with explicit alias input", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const resolved = resolveProvider({ model: "sonnet" });

    expect(resolved.model).toBe("anthropic:claude-sonnet-4-6");
    expect(resolved.providerName).toBe("anthropic");
    expect(resolved.modelDisplayName).toBe("claude-sonnet-4-6");
    expect(resolved.providerDisplayName).toBe("Anthropic");
    expect(resolved.llmClient).toBeDefined();
  });
});

