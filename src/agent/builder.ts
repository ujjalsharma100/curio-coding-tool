import { Agent } from "curio-agent-sdk";
import type { CliRuntimeConfig } from "../cli/args.js";
import { resolveProvider } from "./provider-config.js";
import { buildSystemPrompt } from "./system-prompt.js";

export interface BuildAgentResult {
  agent: Agent;
  model: string;
  providerName: string;
  modelDisplayName: string;
  providerDisplayName: string;
}

export async function buildAgent(
  config: CliRuntimeConfig,
): Promise<BuildAgentResult> {
  const resolved = resolveProvider({
    model: config.model,
    provider: config.provider,
  });

  const systemPrompt = buildSystemPrompt({ cwd: process.cwd() });

  const agent = Agent.builder()
    .model(resolved.model)
    .llmClient(resolved.llmClient)
    .systemPrompt(systemPrompt)
    .maxIterations(config.maxTurns ?? 100)
    .agentName("curio-code")
    .build();

  return {
    agent,
    model: resolved.model,
    providerName: resolved.providerName,
    modelDisplayName: resolved.modelDisplayName,
    providerDisplayName: resolved.providerDisplayName,
  };
}
