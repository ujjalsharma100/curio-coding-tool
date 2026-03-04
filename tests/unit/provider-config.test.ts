import { afterEach, describe, expect, it } from "vitest";
import {
  resolveDefaultModel,
  resolveModelAlias,
  resolveProvider,
  validateApiKeyFormat,
  validateProviderApiKey,
  getModelMetadata,
  getAvailableModels,
  getProviderDisplayName,
  detectAvailableProviders,
  getAllModelAliases,
  getModelTier,
  buildTieredRouter,
  getDefaultRouterConfig,
  registerConfigProviders,
  OpenAICompatibleProvider,
  GeminiProvider,
} from "../../src/agent/provider-config.js";
import type { CurioProviderConfig } from "../../src/agent/provider-config.js";
import { LLMClient } from "curio-agent-sdk";

const ORIGINAL_ENV = { ...process.env };

function resetEnv(): void {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.OLLAMA_HOST;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.TOGETHER_API_KEY;
  delete process.env.MISTRAL_API_KEY;
}

afterEach(() => {
  resetEnv();
});

// ── Phase 1 tests (preserved) ────────────────────────────────────────────

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

// ── Phase 7 tests ────────────────────────────────────────────────────────

describe("Phase 7.1 Provider Registry", () => {
  describe("new model aliases", () => {
    it("resolves gemini aliases", () => {
      expect(resolveModelAlias("gemini")).toBe("gemini:gemini-2.0-flash");
      expect(resolveModelAlias("gemini-pro")).toBe("gemini:gemini-2.0-pro");
      expect(resolveModelAlias("gemini-flash")).toBe("gemini:gemini-2.0-flash");
    });

    it("resolves openrouter alias", () => {
      expect(resolveModelAlias("openrouter")).toBe("openrouter:anthropic/claude-sonnet-4-6");
    });

    it("resolves deepseek aliases", () => {
      expect(resolveModelAlias("deepseek")).toBe("deepseek:deepseek-chat");
      expect(resolveModelAlias("deepseek-coder")).toBe("deepseek:deepseek-coder");
    });

    it("resolves together and mistral aliases", () => {
      expect(resolveModelAlias("together")).toContain("together:");
      expect(resolveModelAlias("mistral")).toBe("mistral:mistral-large-latest");
    });
  });

  describe("getAllModelAliases", () => {
    it("returns all aliases as a plain object", () => {
      const aliases = getAllModelAliases();
      expect(aliases).toBeDefined();
      expect(aliases.sonnet).toBe("anthropic:claude-sonnet-4-6");
      expect(aliases.gemini).toBe("gemini:gemini-2.0-flash");
      expect(aliases.deepseek).toBe("deepseek:deepseek-chat");
      expect(Object.keys(aliases).length).toBeGreaterThan(10);
    });
  });

  describe("custom provider auto-detection", () => {
    it("includes gemini in default model priority when GOOGLE_API_KEY is set", () => {
      process.env.GOOGLE_API_KEY = "test-google-key";
      expect(resolveDefaultModel()).toBe("gemini:gemini-2.0-flash");
    });

    it("includes gemini via GEMINI_API_KEY too", () => {
      process.env.GEMINI_API_KEY = "test-gemini-key";
      expect(resolveDefaultModel()).toBe("gemini:gemini-2.0-flash");
    });

    it("includes openrouter when OPENROUTER_API_KEY is set", () => {
      process.env.OPENROUTER_API_KEY = "sk-or-test";
      expect(resolveDefaultModel()).toBe("openrouter:anthropic/claude-sonnet-4-6");
    });

    it("includes deepseek when DEEPSEEK_API_KEY is set", () => {
      process.env.DEEPSEEK_API_KEY = "sk-test-deepseek";
      expect(resolveDefaultModel()).toBe("deepseek:deepseek-chat");
    });

    it("includes together when TOGETHER_API_KEY is set", () => {
      process.env.TOGETHER_API_KEY = "test-together-key";
      expect(resolveDefaultModel()).toContain("together:");
    });

    it("includes mistral when MISTRAL_API_KEY is set", () => {
      process.env.MISTRAL_API_KEY = "test-mistral-key";
      expect(resolveDefaultModel()).toBe("mistral:mistral-large-latest");
    });

    it("prefers anthropic over other providers", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";
      process.env.GOOGLE_API_KEY = "test-google-key";
      process.env.DEEPSEEK_API_KEY = "sk-test-deepseek";
      expect(resolveDefaultModel()).toBe("anthropic:claude-sonnet-4-6");
    });
  });

  describe("provider key validation for new providers", () => {
    it("validates gemini key presence via GOOGLE_API_KEY", () => {
      expect(() => validateProviderApiKey("gemini")).toThrowError(
        /GOOGLE_API_KEY/,
      );
      process.env.GOOGLE_API_KEY = "test-key";
      expect(() => validateProviderApiKey("gemini")).not.toThrow();
    });

    it("validates gemini key via GEMINI_API_KEY", () => {
      process.env.GEMINI_API_KEY = "test-key";
      expect(() => validateProviderApiKey("gemini")).not.toThrow();
    });

    it("validates openrouter key presence", () => {
      expect(() => validateProviderApiKey("openrouter")).toThrowError(
        /OPENROUTER_API_KEY/,
      );
      process.env.OPENROUTER_API_KEY = "sk-or-test";
      expect(() => validateProviderApiKey("openrouter")).not.toThrow();
    });

    it("validates deepseek key presence", () => {
      expect(() => validateProviderApiKey("deepseek")).toThrowError(
        /DEEPSEEK_API_KEY/,
      );
      process.env.DEEPSEEK_API_KEY = "sk-test";
      expect(() => validateProviderApiKey("deepseek")).not.toThrow();
    });

    it("validates together key presence", () => {
      expect(() => validateProviderApiKey("together")).toThrowError(
        /TOGETHER_API_KEY/,
      );
    });

    it("validates mistral key presence", () => {
      expect(() => validateProviderApiKey("mistral")).toThrowError(
        /MISTRAL_API_KEY/,
      );
    });

    it("does not throw for unknown providers (custom config)", () => {
      expect(() => validateProviderApiKey("my-custom")).not.toThrow();
    });
  });

  describe("resolveProvider with new providers", () => {
    it("resolves gemini provider", () => {
      process.env.GOOGLE_API_KEY = "test-google-key";
      const resolved = resolveProvider({ model: "gemini" });
      expect(resolved.model).toBe("gemini:gemini-2.0-flash");
      expect(resolved.providerName).toBe("gemini");
      expect(resolved.providerDisplayName).toBe("Google Gemini");
      expect(resolved.llmClient).toBeDefined();
    });

    it("resolves deepseek provider", () => {
      process.env.DEEPSEEK_API_KEY = "sk-test-deepseek";
      const resolved = resolveProvider({ model: "deepseek" });
      expect(resolved.model).toBe("deepseek:deepseek-chat");
      expect(resolved.providerName).toBe("deepseek");
      expect(resolved.providerDisplayName).toBe("DeepSeek");
    });

    it("resolves mistral provider", () => {
      process.env.MISTRAL_API_KEY = "test-key";
      const resolved = resolveProvider({ model: "mistral" });
      expect(resolved.model).toBe("mistral:mistral-large-latest");
      expect(resolved.providerName).toBe("mistral");
      expect(resolved.providerDisplayName).toBe("Mistral");
    });

    it("resolves openrouter provider", () => {
      process.env.OPENROUTER_API_KEY = "sk-or-test";
      const resolved = resolveProvider({ model: "openrouter" });
      expect(resolved.providerName).toBe("openrouter");
      expect(resolved.providerDisplayName).toBe("OpenRouter");
    });

    it("includes router when enabled (default)", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";
      const resolved = resolveProvider({ model: "sonnet" });
      expect(resolved.router).toBeDefined();
    });

    it("excludes router when explicitly disabled", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";
      const resolved = resolveProvider({ model: "sonnet", enableRouter: false });
      expect(resolved.router).toBeUndefined();
    });
  });

  describe("custom provider config (JSON-based)", () => {
    it("registers a custom OpenAI-compatible provider via config", () => {
      const client = new LLMClient({ autoDiscover: false });
      const config: CurioProviderConfig = {
        providers: {
          "my-llm": {
            type: "openai-compatible",
            baseUrl: "https://my-api.example.com/v1",
            apiKeyEnv: "MY_LLM_KEY",
            defaultModel: "my-model-1",
            models: ["my-model-1", "my-model-2"],
            displayName: "My LLM",
          },
        },
      };

      registerConfigProviders(client, config);

      const provider = client.getProvider("my-llm");
      expect(provider).toBeDefined();
      expect(provider!.name).toBe("my-llm");
      expect(provider!.supportsModel("my-model-1")).toBe(true);
      expect(provider!.supportsModel("my-model-2")).toBe(true);
    });

    it("does not register when config.providers is undefined", () => {
      const client = new LLMClient({ autoDiscover: false });
      registerConfigProviders(client, {});
      expect(client.getProviderNames()).toHaveLength(0);
    });
  });

  describe("OpenAICompatibleProvider class", () => {
    it("exposes name and supportedModels", () => {
      const provider = new OpenAICompatibleProvider(
        "test-provider",
        "https://api.example.com/v1",
        "TEST_KEY",
        ["model-a", "model-b"],
      );
      expect(provider.name).toBe("test-provider");
      expect(provider.supportedModels).toEqual(["model-a", "model-b"]);
    });

    it("supportsModel returns true for listed models", () => {
      const provider = new OpenAICompatibleProvider(
        "test",
        "https://api.example.com/v1",
        "TEST_KEY",
        ["model-a"],
      );
      expect(provider.supportsModel("model-a")).toBe(true);
      expect(provider.supportsModel("model-z")).toBe(false);
    });

    it("supportsModel returns true for any model when no models listed", () => {
      const provider = new OpenAICompatibleProvider(
        "test",
        "https://api.example.com/v1",
        "TEST_KEY",
        [],
      );
      expect(provider.supportsModel("anything")).toBe(true);
    });
  });

  describe("GeminiProvider class", () => {
    it("exposes name and supported models", () => {
      const provider = new GeminiProvider();
      expect(provider.name).toBe("gemini");
      expect(provider.supportedModels.length).toBeGreaterThan(0);
      expect(provider.supportedModels).toContain("gemini-2.0-flash");
    });

    it("supportsModel checks for gemini- prefix", () => {
      const provider = new GeminiProvider();
      expect(provider.supportsModel("gemini-2.0-flash")).toBe(true);
      expect(provider.supportsModel("gemini-1.5-pro")).toBe(true);
      expect(provider.supportsModel("gpt-4o")).toBe(false);
    });
  });

  describe("detectAvailableProviders", () => {
    it("returns empty when no env vars set", () => {
      expect(detectAvailableProviders()).toEqual([]);
    });

    it("detects all configured providers", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";
      process.env.OPENAI_API_KEY = "sk-test";
      process.env.GOOGLE_API_KEY = "test-google";
      process.env.DEEPSEEK_API_KEY = "sk-deep";

      const available = detectAvailableProviders();
      expect(available).toContain("anthropic");
      expect(available).toContain("openai");
      expect(available).toContain("gemini");
      expect(available).toContain("deepseek");
    });

    it("does not duplicate providers", () => {
      process.env.GOOGLE_API_KEY = "test-key";
      process.env.GEMINI_API_KEY = "test-key2";
      const available = detectAvailableProviders();
      const geminiCount = available.filter((p) => p === "gemini").length;
      expect(geminiCount).toBe(1);
    });
  });
});

describe("Phase 7.2 Model Selection", () => {
  describe("model metadata", () => {
    it("returns metadata for known models", () => {
      const meta = getModelMetadata("anthropic:claude-sonnet-4-6");
      expect(meta).toBeDefined();
      expect(meta!.displayName).toBe("Claude Sonnet 4.6");
      expect(meta!.contextWindow).toBe(200_000);
      expect(meta!.supportsVision).toBe(true);
      expect(meta!.supportsTools).toBe(true);
      expect(meta!.supportsThinking).toBe(true);
    });

    it("returns metadata for GPT-4o", () => {
      const meta = getModelMetadata("openai:gpt-4o");
      expect(meta).toBeDefined();
      expect(meta!.displayName).toBe("GPT-4o");
      expect(meta!.contextWindow).toBe(128_000);
      expect(meta!.supportsVision).toBe(true);
      expect(meta!.supportsThinking).toBe(false);
    });

    it("returns metadata for Gemini models", () => {
      const meta = getModelMetadata("gemini:gemini-2.0-flash");
      expect(meta).toBeDefined();
      expect(meta!.displayName).toBe("Gemini 2.0 Flash");
      expect(meta!.contextWindow).toBe(1_000_000);
      expect(meta!.supportsVision).toBe(true);
    });

    it("returns metadata for DeepSeek models", () => {
      const meta = getModelMetadata("deepseek:deepseek-chat");
      expect(meta).toBeDefined();
      expect(meta!.displayName).toBe("DeepSeek Chat");
      expect(meta!.supportsVision).toBe(false);
    });

    it("returns metadata for Mistral models", () => {
      const meta = getModelMetadata("mistral:mistral-large-latest");
      expect(meta).toBeDefined();
      expect(meta!.displayName).toBe("Mistral Large");
    });

    it("returns undefined for unknown models", () => {
      expect(getModelMetadata("unknown:model")).toBeUndefined();
    });

    it("includes pricing info when available", () => {
      const meta = getModelMetadata("anthropic:claude-opus-4-6");
      expect(meta).toBeDefined();
      expect(meta!.inputPricePerMToken).toBe(15);
      expect(meta!.outputPricePerMToken).toBe(75);
    });

    it("groq models have no pricing", () => {
      const meta = getModelMetadata("groq:llama-3.1-70b-versatile");
      expect(meta).toBeDefined();
      expect(meta!.inputPricePerMToken).toBeUndefined();
    });
  });

  describe("getAvailableModels", () => {
    it("returns a non-empty list of models", () => {
      const models = getAvailableModels();
      expect(models.length).toBeGreaterThan(5);
    });

    it("each model has required fields", () => {
      const models = getAvailableModels();
      for (const m of models) {
        expect(m.id).toBeTruthy();
        expect(m.provider).toBeTruthy();
        expect(m.displayName).toBeTruthy();
        expect(m.contextWindow).toBeGreaterThan(0);
        expect(typeof m.supportsVision).toBe("boolean");
        expect(typeof m.supportsTools).toBe("boolean");
        expect(typeof m.supportsThinking).toBe("boolean");
      }
    });
  });

  describe("getProviderDisplayName", () => {
    it("returns display names for known providers", () => {
      expect(getProviderDisplayName("anthropic")).toBe("Anthropic");
      expect(getProviderDisplayName("openai")).toBe("OpenAI");
      expect(getProviderDisplayName("gemini")).toBe("Google Gemini");
      expect(getProviderDisplayName("deepseek")).toBe("DeepSeek");
      expect(getProviderDisplayName("together")).toBe("Together AI");
      expect(getProviderDisplayName("mistral")).toBe("Mistral");
      expect(getProviderDisplayName("openrouter")).toBe("OpenRouter");
    });

    it("falls back to raw name for unknown providers", () => {
      expect(getProviderDisplayName("my-custom")).toBe("my-custom");
    });
  });
});

describe("Phase 7.3 Tiered Routing", () => {
  describe("getModelTier", () => {
    it("assigns tier 1 to fast/cheap models", () => {
      expect(getModelTier("anthropic:claude-haiku-4-5")).toBe(1);
      expect(getModelTier("openai:gpt-4o-mini")).toBe(1);
      expect(getModelTier("groq:llama-3.1-70b-versatile")).toBe(1);
      expect(getModelTier("gemini:gemini-2.0-flash")).toBe(1);
    });

    it("assigns tier 2 to balanced models", () => {
      expect(getModelTier("anthropic:claude-sonnet-4-6")).toBe(2);
      expect(getModelTier("openai:gpt-4o")).toBe(2);
      expect(getModelTier("gemini:gemini-2.0-pro")).toBe(2);
      expect(getModelTier("deepseek:deepseek-chat")).toBe(2);
      expect(getModelTier("mistral:mistral-large-latest")).toBe(2);
    });

    it("assigns tier 3 to quality models", () => {
      expect(getModelTier("anthropic:claude-opus-4-6")).toBe(3);
      expect(getModelTier("openai:o1")).toBe(3);
      expect(getModelTier("openai:o3")).toBe(3);
    });

    it("returns 0 for unknown models", () => {
      expect(getModelTier("custom:my-model")).toBe(0);
    });
  });

  describe("buildTieredRouter", () => {
    it("creates a TieredRouter with default config", () => {
      const router = buildTieredRouter();
      expect(router).toBeDefined();
      expect(router.hasTiers).toBe(true);
    });

    it("creates a TieredRouter with custom config", () => {
      const router = buildTieredRouter({
        tier1: { models: ["openai:gpt-4o-mini"] },
        tier2: { models: ["openai:gpt-4o"] },
      });
      expect(router).toBeDefined();
      expect(router.hasTiers).toBe(true);
    });
  });

  describe("getDefaultRouterConfig", () => {
    it("returns config with all three tiers", () => {
      const config = getDefaultRouterConfig();
      expect(config.tier1?.models.length).toBeGreaterThan(0);
      expect(config.tier2?.models.length).toBeGreaterThan(0);
      expect(config.tier3?.models.length).toBeGreaterThan(0);
    });

    it("uses fallback_to_lower_tier degradation strategy", () => {
      const config = getDefaultRouterConfig();
      expect(config.degradationStrategy).toBe("fallback_to_lower_tier");
    });
  });
});

describe("Phase 7.4 Model-Specific Adaptations", () => {
  describe("vision support detection", () => {
    it("Claude models support vision", () => {
      expect(getModelMetadata("anthropic:claude-sonnet-4-6")?.supportsVision).toBe(true);
      expect(getModelMetadata("anthropic:claude-opus-4-6")?.supportsVision).toBe(true);
      expect(getModelMetadata("anthropic:claude-haiku-4-5")?.supportsVision).toBe(true);
    });

    it("GPT-4o supports vision", () => {
      expect(getModelMetadata("openai:gpt-4o")?.supportsVision).toBe(true);
    });

    it("Gemini supports vision", () => {
      expect(getModelMetadata("gemini:gemini-2.0-flash")?.supportsVision).toBe(true);
      expect(getModelMetadata("gemini:gemini-2.0-pro")?.supportsVision).toBe(true);
    });

    it("Groq Llama does NOT support vision", () => {
      expect(getModelMetadata("groq:llama-3.1-70b-versatile")?.supportsVision).toBe(false);
    });

    it("DeepSeek does NOT support vision", () => {
      expect(getModelMetadata("deepseek:deepseek-chat")?.supportsVision).toBe(false);
    });
  });

  describe("thinking/reasoning support detection", () => {
    it("Anthropic Opus and Sonnet support thinking", () => {
      expect(getModelMetadata("anthropic:claude-opus-4-6")?.supportsThinking).toBe(true);
      expect(getModelMetadata("anthropic:claude-sonnet-4-6")?.supportsThinking).toBe(true);
    });

    it("Haiku does not support thinking", () => {
      expect(getModelMetadata("anthropic:claude-haiku-4-5")?.supportsThinking).toBe(false);
    });

    it("OpenAI o1 and o3 support thinking", () => {
      expect(getModelMetadata("openai:o1")?.supportsThinking).toBe(true);
      expect(getModelMetadata("openai:o3")?.supportsThinking).toBe(true);
    });

    it("GPT-4o does NOT support thinking", () => {
      expect(getModelMetadata("openai:gpt-4o")?.supportsThinking).toBe(false);
    });
  });
});
