import { ContextManager, parseModelString } from "curio-agent-sdk";
import type { Message } from "curio-agent-sdk";

export type ContextStrategyName = "truncate_oldest" | "summarize";

export interface ContextWindowConfig {
  maxTokens: number;
  reserveTokens: number;
  strategy: ContextStrategyName;
}

export interface ContextWindowRuntime {
  manager: ContextManager;
  config: ContextWindowConfig;
}

const CONTEXT_COMPRESSED_MESSAGE =
  "[context compressed - older messages summarized]";

function resolveDefaultContextConfig(model: string): ContextWindowConfig {
  const parsed = parseModelString(model);
  const provider = parsed.provider;
  const modelId = parsed.modelId.toLowerCase();

  if (provider === "anthropic") {
    return { maxTokens: 200_000, reserveTokens: 20_000, strategy: "truncate_oldest" };
  }
  if (provider === "openai") {
    if (modelId.includes("gpt-4o")) {
      return { maxTokens: 128_000, reserveTokens: 18_000, strategy: "truncate_oldest" };
    }
    return { maxTokens: 64_000, reserveTokens: 8_000, strategy: "truncate_oldest" };
  }
  if (provider === "groq") {
    return { maxTokens: 32_000, reserveTokens: 4_000, strategy: "truncate_oldest" };
  }
  if (provider === "ollama") {
    return { maxTokens: 16_000, reserveTokens: 2_000, strategy: "truncate_oldest" };
  }
  return { maxTokens: 64_000, reserveTokens: 8_000, strategy: "truncate_oldest" };
}

function resolveStrategy(defaultStrategy: ContextStrategyName): ContextStrategyName {
  const fromEnv = process.env.CURIO_CODE_CONTEXT_STRATEGY;
  if (fromEnv === "truncate_oldest" || fromEnv === "summarize") {
    return fromEnv;
  }
  return defaultStrategy;
}

export function buildContextWindowRuntime(model: string): ContextWindowRuntime {
  const defaults = resolveDefaultContextConfig(model);
  const strategy = resolveStrategy(defaults.strategy);
  const config: ContextWindowConfig = { ...defaults, strategy };

  const summarizer = async (): Promise<Message> => ({
    role: "system",
    content: CONTEXT_COMPRESSED_MESSAGE,
  });

  const manager = new ContextManager({
    maxTokens: config.maxTokens,
    reserveTokens: config.reserveTokens,
    strategy: config.strategy,
    summarizer: config.strategy === "summarize" ? summarizer : undefined,
  });

  return { manager, config };
}

export function buildContextBudgetLabel(config: ContextWindowConfig): string {
  const budget = Math.max(0, config.maxTokens - config.reserveTokens);
  return `${budget}/${config.maxTokens} tokens (${config.strategy})`;
}
