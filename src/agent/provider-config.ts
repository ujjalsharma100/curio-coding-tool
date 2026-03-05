import {
  LLMClient,
  OpenAIProvider,
  TieredRouter,
  parseModelString,
} from "curio-agent-sdk";
import type { LLMProvider, ProviderConfig, RouterConfig } from "curio-agent-sdk";

// ---------------------------------------------------------------------------
// Model aliases — short names users can type on the CLI
// ---------------------------------------------------------------------------

const MODEL_ALIASES: Record<string, string> = {
  // Anthropic
  sonnet: "anthropic:claude-sonnet-4-6",
  opus: "anthropic:claude-opus-4-6",
  haiku: "anthropic:claude-haiku-4-5",
  // OpenAI
  gpt4o: "openai:gpt-4o",
  "gpt-4o": "openai:gpt-4o",
  "gpt4o-mini": "openai:gpt-4o-mini",
  "gpt-4o-mini": "openai:gpt-4o-mini",
  o1: "openai:o1",
  o3: "openai:o3",
  // Groq
  llama: "groq:llama-3.3-70b-versatile",
  // Gemini (custom provider)
  gemini: "gemini:gemini-2.0-flash",
  "gemini-pro": "gemini:gemini-2.0-pro",
  "gemini-flash": "gemini:gemini-2.0-flash",
  // OpenRouter
  openrouter: "openrouter:anthropic/claude-sonnet-4-6",
  // DeepSeek
  deepseek: "deepseek:deepseek-chat",
  "deepseek-coder": "deepseek:deepseek-coder",
  // Together
  together: "together:meta-llama/Llama-3.1-70B-Instruct-Turbo",
  // Mistral
  mistral: "mistral:mistral-large-latest",
};

// ---------------------------------------------------------------------------
// Default model priority (used when no --model flag is given)
// ---------------------------------------------------------------------------

const DEFAULT_MODEL_PRIORITY: Array<{
  envKey: string;
  model: string;
  provider: string;
}> = [
  {
    envKey: "ANTHROPIC_API_KEY",
    model: "anthropic:claude-sonnet-4-6",
    provider: "anthropic",
  },
  { envKey: "OPENAI_API_KEY", model: "openai:gpt-4o", provider: "openai" },
  {
    envKey: "GROQ_API_KEY",
    model: "groq:llama-3.3-70b-versatile",
    provider: "groq",
  },
  {
    envKey: "GOOGLE_API_KEY",
    model: "gemini:gemini-2.0-flash",
    provider: "gemini",
  },
  {
    envKey: "GEMINI_API_KEY",
    model: "gemini:gemini-2.0-flash",
    provider: "gemini",
  },
  {
    envKey: "OPENROUTER_API_KEY",
    model: "openrouter:anthropic/claude-sonnet-4-6",
    provider: "openrouter",
  },
  {
    envKey: "DEEPSEEK_API_KEY",
    model: "deepseek:deepseek-chat",
    provider: "deepseek",
  },
  {
    envKey: "TOGETHER_API_KEY",
    model: "together:meta-llama/Llama-3.1-70B-Instruct-Turbo",
    provider: "together",
  },
  {
    envKey: "MISTRAL_API_KEY",
    model: "mistral:mistral-large-latest",
    provider: "mistral",
  },
  {
    envKey: "OLLAMA_HOST",
    model: "ollama:llama3.1",
    provider: "ollama",
  },
];

// ---------------------------------------------------------------------------
// Provider display names
// ---------------------------------------------------------------------------

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  groq: "Groq",
  ollama: "Ollama",
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  together: "Together AI",
  mistral: "Mistral",
};

// ---------------------------------------------------------------------------
// Model metadata (for /model info and vision/thinking support detection)
// ---------------------------------------------------------------------------

export interface ModelMetadata {
  id: string;
  provider: string;
  displayName: string;
  contextWindow: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsThinking: boolean;
  inputPricePerMToken?: number;
  outputPricePerMToken?: number;
}

const MODEL_METADATA: Record<string, ModelMetadata> = {
  // Anthropic
  "anthropic:claude-opus-4-6": {
    id: "claude-opus-4-6", provider: "anthropic", displayName: "Claude Opus 4.6",
    contextWindow: 200_000, supportsVision: true, supportsTools: true, supportsThinking: true,
    inputPricePerMToken: 15, outputPricePerMToken: 75,
  },
  "anthropic:claude-sonnet-4-6": {
    id: "claude-sonnet-4-6", provider: "anthropic", displayName: "Claude Sonnet 4.6",
    contextWindow: 200_000, supportsVision: true, supportsTools: true, supportsThinking: true,
    inputPricePerMToken: 3, outputPricePerMToken: 15,
  },
  "anthropic:claude-haiku-4-5": {
    id: "claude-haiku-4-5", provider: "anthropic", displayName: "Claude Haiku 4.5",
    contextWindow: 200_000, supportsVision: true, supportsTools: true, supportsThinking: false,
    inputPricePerMToken: 0.8, outputPricePerMToken: 4,
  },
  // OpenAI
  "openai:gpt-4o": {
    id: "gpt-4o", provider: "openai", displayName: "GPT-4o",
    contextWindow: 128_000, supportsVision: true, supportsTools: true, supportsThinking: false,
    inputPricePerMToken: 2.5, outputPricePerMToken: 10,
  },
  "openai:gpt-4o-mini": {
    id: "gpt-4o-mini", provider: "openai", displayName: "GPT-4o Mini",
    contextWindow: 128_000, supportsVision: true, supportsTools: true, supportsThinking: false,
    inputPricePerMToken: 0.15, outputPricePerMToken: 0.6,
  },
  "openai:o1": {
    id: "o1", provider: "openai", displayName: "o1",
    contextWindow: 200_000, supportsVision: true, supportsTools: true, supportsThinking: true,
    inputPricePerMToken: 15, outputPricePerMToken: 60,
  },
  "openai:o3": {
    id: "o3", provider: "openai", displayName: "o3",
    contextWindow: 200_000, supportsVision: true, supportsTools: true, supportsThinking: true,
    inputPricePerMToken: 10, outputPricePerMToken: 40,
  },
  // Groq
  "groq:mixtral-8x7b-32768": {
    id: "mixtral-8x7b-32768", provider: "groq", displayName: "Mixtral 8x7B",
    contextWindow: 32_000, supportsVision: false, supportsTools: true, supportsThinking: false,
  },
  "groq:openai/gpt-oss-20b": {
    id: "openai/gpt-oss-20b", provider: "groq", displayName: "GPT-OSS 20B",
    contextWindow: 131_072, supportsVision: false, supportsTools: true, supportsThinking: false,
  },
  "groq:llama-3.1-8b-instant": {
    id: "llama-3.1-8b-instant", provider: "groq", displayName: "Llama 3.1 8B Instant",
    contextWindow: 131_072, supportsVision: false, supportsTools: true, supportsThinking: false,
  },
  "groq:meta-llama/llama-4-scout-17b-16e-instruct": {
    id: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "groq", displayName: "Llama 4 Scout 17B",
    contextWindow: 131_072, supportsVision: false, supportsTools: true, supportsThinking: false,
  },
  "groq:llama-3.3-70b-versatile": {
    id: "llama-3.3-70b-versatile", provider: "groq", displayName: "Llama 3.3 70B Versatile",
    contextWindow: 131_072, supportsVision: false, supportsTools: true, supportsThinking: false,
  },
  "groq:moonshotai/kimi-k2-instruct-0905": {
    id: "moonshotai/kimi-k2-instruct-0905", provider: "groq", displayName: "Kimi K2 Instruct 0905",
    contextWindow: 131_072, supportsVision: false, supportsTools: true, supportsThinking: false,
  },
  "groq:qwen/qwen3-32b": {
    id: "qwen/qwen3-32b", provider: "groq", displayName: "Qwen 3 32B",
    contextWindow: 131_072, supportsVision: false, supportsTools: true, supportsThinking: false,
  },
  "groq:meta-llama/llama-4-maverick-17b-128e-instruct": {
    id: "meta-llama/llama-4-maverick-17b-128e-instruct", provider: "groq", displayName: "Llama 4 Maverick 17B",
    contextWindow: 131_072, supportsVision: false, supportsTools: true, supportsThinking: false,
  },
  // Gemini
  "gemini:gemini-2.0-flash": {
    id: "gemini-2.0-flash", provider: "gemini", displayName: "Gemini 2.0 Flash",
    contextWindow: 1_000_000, supportsVision: true, supportsTools: true, supportsThinking: false,
    inputPricePerMToken: 0.075, outputPricePerMToken: 0.3,
  },
  "gemini:gemini-2.0-pro": {
    id: "gemini-2.0-pro", provider: "gemini", displayName: "Gemini 2.0 Pro",
    contextWindow: 2_000_000, supportsVision: true, supportsTools: true, supportsThinking: true,
    inputPricePerMToken: 1.25, outputPricePerMToken: 10,
  },
  // DeepSeek
  "deepseek:deepseek-chat": {
    id: "deepseek-chat", provider: "deepseek", displayName: "DeepSeek Chat",
    contextWindow: 64_000, supportsVision: false, supportsTools: true, supportsThinking: false,
    inputPricePerMToken: 0.14, outputPricePerMToken: 0.28,
  },
  "deepseek:deepseek-coder": {
    id: "deepseek-coder", provider: "deepseek", displayName: "DeepSeek Coder",
    contextWindow: 64_000, supportsVision: false, supportsTools: true, supportsThinking: false,
    inputPricePerMToken: 0.14, outputPricePerMToken: 0.28,
  },
  // Mistral
  "mistral:mistral-large-latest": {
    id: "mistral-large-latest", provider: "mistral", displayName: "Mistral Large",
    contextWindow: 128_000, supportsVision: false, supportsTools: true, supportsThinking: false,
    inputPricePerMToken: 2, outputPricePerMToken: 6,
  },
};

// ---------------------------------------------------------------------------
// Custom provider config (JSON config format for user-defined providers)
// ---------------------------------------------------------------------------

export interface CustomProviderDefinition {
  type: "openai-compatible";
  baseUrl: string;
  apiKeyEnv: string;
  defaultModel: string;
  models?: string[];
  displayName?: string;
}

export interface CurioProviderConfig {
  providers?: Record<string, CustomProviderDefinition>;
  defaultModel?: string;
}

// ---------------------------------------------------------------------------
// OpenAI-compatible provider factory
//
// Wraps the SDK's OpenAIProvider with a custom name + base URL so that any
// OpenAI-compatible API (OpenRouter, DeepSeek, Together, Mistral, vLLM,
// LocalAI, LM Studio …) can be used with zero extra dependencies.
// ---------------------------------------------------------------------------

const OPENAI_COMPATIBLE_PROVIDERS: Record<string, {
  baseUrl: string;
  apiKeyEnv: string;
  models: string[];
  displayName: string;
}> = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    models: [],
    displayName: "OpenRouter",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
    displayName: "DeepSeek",
  },
  together: {
    baseUrl: "https://api.together.xyz/v1",
    apiKeyEnv: "TOGETHER_API_KEY",
    models: [],
    displayName: "Together AI",
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1",
    apiKeyEnv: "MISTRAL_API_KEY",
    models: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "codestral-latest"],
    displayName: "Mistral",
  },
};

class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  readonly supportedModels: string[];
  private readonly openaiProvider = new OpenAIProvider();
  private readonly baseUrl: string;
  private readonly apiKeyEnv: string;

  constructor(
    name: string,
    baseUrl: string,
    apiKeyEnv: string,
    models: string[] = [],
  ) {
    this.name = name;
    this.baseUrl = baseUrl;
    this.apiKeyEnv = apiKeyEnv;
    this.supportedModels = models;
  }

  supportsModel(_model: string): boolean {
    if (this.supportedModels.length === 0) return true;
    return this.supportedModels.includes(_model);
  }

  async call(request: LLMRequest, config: ProviderConfig): Promise<LLMResponse> {
    const mergedConfig: ProviderConfig = {
      ...config,
      apiKey: config.apiKey ?? process.env[this.apiKeyEnv],
      baseUrl: config.baseUrl ?? this.baseUrl,
    };
    return this.openaiProvider.call(request, mergedConfig);
  }

  async *stream(
    request: LLMRequest,
    config: ProviderConfig,
  ): AsyncIterableIterator<LLMStreamChunk> {
    const mergedConfig: ProviderConfig = {
      ...config,
      apiKey: config.apiKey ?? process.env[this.apiKeyEnv],
      baseUrl: config.baseUrl ?? this.baseUrl,
    };
    yield* this.openaiProvider.stream(request, mergedConfig);
  }
}

// We need the SDK request/response types for the provider interface.
// They are re-exported through curio-agent-sdk.
import type { LLMRequest, LLMResponse, LLMStreamChunk } from "curio-agent-sdk";

// ---------------------------------------------------------------------------
// Gemini provider — uses Google's REST API directly (no extra dependency)
//
// Implements LLMProvider for models like gemini-2.0-flash, gemini-2.0-pro.
// Tool calling is mapped from the SDK's generic format to Gemini's format.
// ---------------------------------------------------------------------------

class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  readonly supportedModels = [
    "gemini-2.0-flash",
    "gemini-2.0-pro",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ];

  supportsModel(model: string): boolean {
    return model.startsWith("gemini-");
  }

  async call(request: LLMRequest, config: ProviderConfig): Promise<LLMResponse> {
    const apiKey = config.apiKey ?? process.env["GOOGLE_API_KEY"] ?? process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY is required for Gemini provider.");

    const baseUrl = config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
    const url = `${baseUrl}/models/${request.model}:generateContent?key=${apiKey}`;

    const body = this.buildRequestBody(request);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...config.headers },
      body: JSON.stringify(body),
      signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${text}`);
    }

    const json = await res.json() as GeminiResponse;
    return this.parseResponse(json, request.model);
  }

  async *stream(
    request: LLMRequest,
    config: ProviderConfig,
  ): AsyncIterableIterator<LLMStreamChunk> {
    const apiKey = config.apiKey ?? process.env["GOOGLE_API_KEY"] ?? process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("GOOGLE_API_KEY or GEMINI_API_KEY is required for Gemini provider.");

    const baseUrl = config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
    const url = `${baseUrl}/models/${request.model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const body = this.buildRequestBody(request);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...config.headers },
      body: JSON.stringify(body),
      signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini API streaming error (${res.status}): ${text}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body from Gemini streaming endpoint.");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            const doneChunk: LLMStreamChunk = { type: "done", finishReason: "stop" };
            yield doneChunk;
            return;
          }

          try {
            const parsed = JSON.parse(data) as GeminiResponse;
            const candidate = parsed.candidates?.[0];
            if (!candidate) continue;

            const part = candidate.content?.parts?.[0];
            if (!part) continue;

            if (part.functionCall) {
              const toolCallChunk: LLMStreamChunk = {
                type: "tool_call_delta",
                toolCall: {
                  id: `call_${Date.now()}`,
                  name: part.functionCall.name,
                  arguments: part.functionCall.args ?? {},
                },
              };
              yield toolCallChunk;
            } else if (part.text) {
              const textChunk: LLMStreamChunk = { type: "text_delta", text: part.text };
              yield textChunk;
            }

            if (candidate.finishReason) {
              const doneChunk: LLMStreamChunk = {
                type: "done",
                finishReason: mapGeminiFinishReason(candidate.finishReason),
              };
              yield doneChunk;
            }
          } catch {
            // skip malformed JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const finalDone: LLMStreamChunk = { type: "done", finishReason: "stop" };
    yield finalDone;
  }

  private buildRequestBody(request: LLMRequest): Record<string, unknown> {
    const contents: GeminiContent[] = [];
    let systemInstruction: GeminiContent | undefined;

    for (const msg of request.messages) {
      if (msg.role === "system") {
        const text = typeof msg.content === "string" ? msg.content
          : (msg.content as Array<{ type: string; text?: string }>)
              .filter((p) => p.type === "text")
              .map((p) => p.text)
              .join("\n");
        systemInstruction = { role: "user", parts: [{ text }] };
        continue;
      }

      const role = msg.role === "assistant" ? "model" : "user";
      const text = typeof msg.content === "string" ? msg.content
        : (msg.content as Array<{ type: string; text?: string }>)
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("\n");

      if (text) {
        contents.push({ role, parts: [{ text }] });
      }
    }

    const body: Record<string, unknown> = { contents };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = [{
        functionDeclarations: request.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      }];
    }

    if (request.maxTokens) {
      body.generationConfig = {
        maxOutputTokens: request.maxTokens,
        temperature: request.temperature,
      };
    }

    return body;
  }

  private parseResponse(json: GeminiResponse, model: string): LLMResponse {
    const candidate = json.candidates?.[0];
    if (!candidate) {
      throw new Error("No candidates in Gemini response.");
    }

    const parts = candidate.content?.parts ?? [];
    let text = "";
    const toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];

    for (const part of parts) {
      if (part.text) {
        text += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args ?? {},
        });
      }
    }

    const usage = json.usageMetadata;

    const promptTokens = usage?.promptTokenCount ?? 0;
    const completionTokens = usage?.candidatesTokenCount ?? 0;

    return {
      content: text,
      toolCalls: toolCalls,
      finishReason: mapGeminiFinishReason(candidate.finishReason),
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      model,
    } as LLMResponse;
  }
}

// Gemini API types (subset)
interface GeminiContent {
  role: string;
  parts: Array<{
    text?: string;
    functionCall?: { name: string; args?: Record<string, unknown> };
  }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts: GeminiContent["parts"] };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

type FinishReason = "stop" | "tool_calls" | "length" | "content_filter" | "error";

function mapGeminiFinishReason(reason?: string): FinishReason {
  switch (reason) {
    case "STOP": return "stop";
    case "MAX_TOKENS": return "length";
    case "SAFETY": return "content_filter";
    case "RECITATION": return "content_filter";
    default: return "stop";
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function resolveModelAlias(input: string): string {
  return MODEL_ALIASES[input.toLowerCase()] ?? input;
}

export function getAllModelAliases(): Record<string, string> {
  return { ...MODEL_ALIASES };
}

export function resolveDefaultModel(): string {
  for (const { envKey, model } of DEFAULT_MODEL_PRIORITY) {
    if (process.env[envKey]) {
      return model;
    }
  }
  throw new Error(
    "No LLM provider configured.\n" +
      "Set one of the following environment variables:\n" +
      "  export ANTHROPIC_API_KEY=sk-ant-...   (for Claude models)\n" +
      "  export OPENAI_API_KEY=sk-...           (for GPT models)\n" +
      "  export GROQ_API_KEY=gsk_...            (for Groq models)\n" +
      "  export GOOGLE_API_KEY=...              (for Gemini models)\n" +
      "  export OPENROUTER_API_KEY=...          (for OpenRouter models)\n" +
      "  export DEEPSEEK_API_KEY=...            (for DeepSeek models)\n" +
      "  export TOGETHER_API_KEY=...            (for Together AI models)\n" +
      "  export MISTRAL_API_KEY=...             (for Mistral models)\n" +
      "  export OLLAMA_HOST=http://localhost:11434  (for local Ollama models)\n" +
      "\nOr specify a model explicitly: curio-code --model gpt-4o",
  );
}

export function validateProviderApiKey(providerName: string): void {
  const keyMap: Record<string, { envVar: string; example: string }> = {
    anthropic: {
      envVar: "ANTHROPIC_API_KEY",
      example: "export ANTHROPIC_API_KEY=sk-ant-...",
    },
    openai: {
      envVar: "OPENAI_API_KEY",
      example: "export OPENAI_API_KEY=sk-...",
    },
    groq: {
      envVar: "GROQ_API_KEY",
      example: "export GROQ_API_KEY=gsk_...",
    },
    gemini: {
      envVar: "GOOGLE_API_KEY",
      example: "export GOOGLE_API_KEY=... (or GEMINI_API_KEY=...)",
    },
    openrouter: {
      envVar: "OPENROUTER_API_KEY",
      example: "export OPENROUTER_API_KEY=sk-or-...",
    },
    deepseek: {
      envVar: "DEEPSEEK_API_KEY",
      example: "export DEEPSEEK_API_KEY=sk-...",
    },
    together: {
      envVar: "TOGETHER_API_KEY",
      example: "export TOGETHER_API_KEY=...",
    },
    mistral: {
      envVar: "MISTRAL_API_KEY",
      example: "export MISTRAL_API_KEY=...",
    },
  };

  const info = keyMap[providerName];
  if (!info) return; // ollama and unknown custom providers don't need a key

  // Gemini supports either env var
  if (providerName === "gemini") {
    if (!process.env["GOOGLE_API_KEY"] && !process.env["GEMINI_API_KEY"]) {
      throw new Error(
        `GOOGLE_API_KEY (or GEMINI_API_KEY) is not set.\n` +
          `To use Gemini models, set your API key: ${info.example}\n` +
          `Or use a different provider: curio-code --model sonnet`,
      );
    }
    return;
  }

  const key = process.env[info.envVar];
  if (!key) {
    throw new Error(
      `${info.envVar} is not set.\n` +
        `To use ${providerName} models, set your API key: ${info.example}\n` +
        `Or use a different provider: curio-code --model gpt-4o`,
    );
  }
}

export function validateApiKeyFormat(
  providerName: string,
  key: string,
): boolean {
  switch (providerName) {
    case "anthropic":
      return key.startsWith("sk-ant-");
    case "openai":
      return key.startsWith("sk-");
    case "groq":
      return key.startsWith("gsk_");
    default:
      return key.length > 0;
  }
}

export function getModelMetadata(model: string): ModelMetadata | undefined {
  return MODEL_METADATA[model];
}

export function getAvailableModels(): ModelMetadata[] {
  return Object.values(MODEL_METADATA);
}

export function getProviderDisplayName(providerName: string): string {
  return PROVIDER_DISPLAY_NAMES[providerName] ?? providerName;
}

/**
 * Detect all providers available based on environment variables.
 * Returns provider names that have valid API keys set.
 */
export function detectAvailableProviders(): string[] {
  const available: string[] = [];
  for (const { envKey, provider } of DEFAULT_MODEL_PRIORITY) {
    if (process.env[envKey] && !available.includes(provider)) {
      available.push(provider);
    }
  }
  return available;
}

// ---------------------------------------------------------------------------
// Tiered routing — smart model selection across quality/cost tiers
// ---------------------------------------------------------------------------

const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  tier1: {
    models: [
      "anthropic:claude-haiku-4-5",
      "openai:gpt-4o-mini",
      "groq:llama-3.3-70b-versatile",
      "gemini:gemini-2.0-flash",
    ],
  },
  tier2: {
    models: [
      "anthropic:claude-sonnet-4-6",
      "openai:gpt-4o",
      "gemini:gemini-2.0-pro",
      "deepseek:deepseek-chat",
      "mistral:mistral-large-latest",
    ],
  },
  tier3: {
    models: [
      "anthropic:claude-opus-4-6",
      "openai:o1",
      "openai:o3",
    ],
  },
  degradationStrategy: "fallback_to_lower_tier",
};

export function buildTieredRouter(config?: RouterConfig): TieredRouter {
  return new TieredRouter(config ?? DEFAULT_ROUTER_CONFIG);
}

export function getDefaultRouterConfig(): RouterConfig {
  return { ...DEFAULT_ROUTER_CONFIG };
}

/**
 * Determine which tier a model falls into (1 = fast/cheap, 2 = balanced, 3 = quality).
 * Returns 0 if the model is not in any tier.
 */
export function getModelTier(model: string): number {
  const cfg = DEFAULT_ROUTER_CONFIG;
  if (cfg.tier1?.models.includes(model)) return 1;
  if (cfg.tier2?.models.includes(model)) return 2;
  if (cfg.tier3?.models.includes(model)) return 3;
  return 0;
}

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

export interface ResolvedProvider {
  llmClient: LLMClient;
  model: string;
  providerName: string;
  modelDisplayName: string;
  providerDisplayName: string;
  router?: TieredRouter;
}

/**
 * Register custom OpenAI-compatible providers and the Gemini provider on an
 * LLMClient instance. Called after the SDK's auto-discovery has registered
 * the four built-in providers (anthropic, openai, groq, ollama).
 */
function registerCustomProviders(
  client: LLMClient,
  providerName?: string,
): void {
  // Always register Gemini if a key is available (or if explicitly requested)
  const geminiKey = process.env["GOOGLE_API_KEY"] ?? process.env["GEMINI_API_KEY"];
  if (geminiKey || providerName === "gemini") {
    client.registerProvider(new GeminiProvider(), {
      apiKey: geminiKey,
    });
  }

  // Register built-in OpenAI-compatible providers based on env vars (or explicit request)
  for (const [name, def] of Object.entries(OPENAI_COMPATIBLE_PROVIDERS)) {
    const key = process.env[def.apiKeyEnv];
    if (key || providerName === name) {
      client.registerProvider(
        new OpenAICompatibleProvider(name, def.baseUrl, def.apiKeyEnv, def.models),
        { apiKey: key, baseUrl: def.baseUrl },
      );
    }
  }
}

/**
 * Register user-defined providers from a config object (e.g. loaded from a
 * JSON config file or passed programmatically).
 */
export function registerConfigProviders(
  client: LLMClient,
  config: CurioProviderConfig,
): void {
  if (!config.providers) return;

  for (const [name, def] of Object.entries(config.providers)) {
    if (def.type === "openai-compatible") {
      const key = process.env[def.apiKeyEnv];
      client.registerProvider(
        new OpenAICompatibleProvider(name, def.baseUrl, def.apiKeyEnv, def.models ?? []),
        { apiKey: key, baseUrl: def.baseUrl },
      );
      if (def.displayName) {
        PROVIDER_DISPLAY_NAMES[name] = def.displayName;
      }
    }
  }
}

export function resolveProvider(options: {
  model?: string;
  provider?: string;
  customProviders?: CurioProviderConfig;
  enableRouter?: boolean;
  routerConfig?: RouterConfig;
}): ResolvedProvider {
  const model = options.model
    ? resolveModelAlias(options.model)
    : resolveDefaultModel();

  const parsed = parseModelString(model);
  const providerName = parsed.provider ?? options.provider ?? "anthropic";

  validateProviderApiKey(providerName);

  const router = options.enableRouter !== false
    ? buildTieredRouter(options.routerConfig)
    : undefined;

  const llmClient = new LLMClient({
    autoDiscover: true,
    router: router ? (options.routerConfig ?? DEFAULT_ROUTER_CONFIG) : undefined,
  });

  registerCustomProviders(llmClient, providerName);

  if (options.customProviders) {
    registerConfigProviders(llmClient, options.customProviders);
  }

  return {
    llmClient,
    model,
    providerName,
    modelDisplayName: parsed.modelId,
    providerDisplayName:
      PROVIDER_DISPLAY_NAMES[providerName] ?? providerName,
    router,
  };
}

// Re-export for convenience
export { OpenAICompatibleProvider, GeminiProvider };
