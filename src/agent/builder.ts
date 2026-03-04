import { Agent } from "curio-agent-sdk";
import type { CliRuntimeConfig } from "../cli/args.js";
import { resolveProvider } from "./provider-config.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { phaseTwoTools } from "../tools/index.js";
import {
  buildContextBudgetLabel,
  buildContextWindowRuntime,
} from "../context/context-window.js";
import {
  type PermissionMode,
  buildPermissionSystem,
  permissionModeStartupWarning,
  CliPermissionHandler,
  AutoAllowHandler,
} from "../permissions/index.js";

export interface BuildAgentResult {
  agent: Agent;
  model: string;
  providerName: string;
  modelDisplayName: string;
  providerDisplayName: string;
  contextBudgetLabel: string;
  permissionMode: PermissionMode;
}

export async function buildAgent(
  config: CliRuntimeConfig,
): Promise<BuildAgentResult> {
  const resolved = resolveProvider({
    model: config.model,
    provider: config.provider,
  });

  // Temporary compatibility: Ollama's current tools JSON Schema support is
  // stricter than other providers and rejects the auto-generated schemas from
  // our Zod-based tools. Until the SDK normalizes schemas specifically for
  // Ollama, we avoid registering tools when using an Ollama model so that
  // basic chat still works without tool calls.
  const toolsForProvider =
    resolved.providerName === "ollama" ? [] : phaseTwoTools;

  const systemPrompt = await buildSystemPrompt({ cwd: process.cwd() });
  const contextWindow = buildContextWindowRuntime(resolved.model);

  const mode: PermissionMode = config.permissionMode ?? "ask";

  const warning = permissionModeStartupWarning(mode);
  if (warning) {
    process.stderr.write(`⚠ ${warning}\n`);
  }

  const { policy } = buildPermissionSystem({
    mode,
    projectRoot: process.cwd(),
  });

  const humanInput = mode === "auto"
    ? new AutoAllowHandler()
    : new CliPermissionHandler();

  const builder = Agent.builder()
    .model(resolved.model)
    .llmClient(resolved.llmClient)
    .systemPrompt(systemPrompt)
    .tools(toolsForProvider)
    .contextManager(contextWindow.manager)
    .maxIterations(config.maxTurns ?? 100)
    .agentName("curio-code")
    .permissions(policy)
    .humanInput(humanInput);

  const agent = builder.build();

  return {
    agent,
    model: resolved.model,
    providerName: resolved.providerName,
    modelDisplayName: resolved.modelDisplayName,
    providerDisplayName: resolved.providerDisplayName,
    contextBudgetLabel: buildContextBudgetLabel(contextWindow.config),
    permissionMode: mode,
  };
}
