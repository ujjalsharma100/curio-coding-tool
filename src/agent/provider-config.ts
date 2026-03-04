import { LLMClient, parseModelString } from "curio-agent-sdk";

const MODEL_ALIASES: Record<string, string> = {
  sonnet: "anthropic:claude-sonnet-4-6",
  opus: "anthropic:claude-opus-4-6",
  haiku: "anthropic:claude-haiku-4-5",
  gpt4o: "openai:gpt-4o",
  "gpt-4o": "openai:gpt-4o",
  "gpt4o-mini": "openai:gpt-4o-mini",
  "gpt-4o-mini": "openai:gpt-4o-mini",
  o1: "openai:o1",
  o3: "openai:o3",
  llama: "groq:llama-3.1-70b-versatile",
};

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
    model: "groq:llama-3.1-70b-versatile",
    provider: "groq",
  },
  {
    envKey: "OLLAMA_HOST",
    model: "ollama:llama3.1",
    provider: "ollama",
  },
];

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  groq: "Groq",
  ollama: "Ollama",
};

export function resolveModelAlias(input: string): string {
  return MODEL_ALIASES[input.toLowerCase()] ?? input;
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
  };

  const info = keyMap[providerName];
  if (!info) return; // ollama doesn't need a key

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

export interface ResolvedProvider {
  llmClient: LLMClient;
  model: string;
  providerName: string;
  modelDisplayName: string;
  providerDisplayName: string;
}

export function resolveProvider(options: {
  model?: string;
  provider?: string;
}): ResolvedProvider {
  const model = options.model
    ? resolveModelAlias(options.model)
    : resolveDefaultModel();

  const parsed = parseModelString(model);
  const providerName = parsed.provider ?? options.provider ?? "anthropic";

  validateProviderApiKey(providerName);

  const llmClient = new LLMClient({ autoDiscover: true });

  return {
    llmClient,
    model,
    providerName,
    modelDisplayName: parsed.modelId,
    providerDisplayName:
      PROVIDER_DISPLAY_NAMES[providerName] ?? providerName,
  };
}
