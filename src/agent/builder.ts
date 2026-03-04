import { Agent } from "curio-agent-sdk";
import type { CliRuntimeConfig } from "../cli/args.js";
import { resolveProvider } from "./provider-config.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { phaseTwoTools, readOnlyTools } from "../tools/index.js";
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
import { CurioSessionManager } from "../sessions/manager.js";
import {
  buildMemorySystem,
  getMemoryForPrompt,
  type CurioMemorySystem,
} from "../memory/index.js";
import type { MemoryFileManager } from "../memory/memory-file.js";
import { TodoManager, createTodoTools } from "../todos/index.js";
import { createPlanState } from "../plan/index.js";
import { createPlanTools, type PlanStateRef } from "../plan/plan-tools.js";
import { createSkillRegistry } from "../skills/index.js";
import { loadMergedMcpConfig, McpBridgeManager } from "../mcp/index.js";

export interface BuildAgentResult {
  agent: Agent;
  model: string;
  providerName: string;
  modelDisplayName: string;
  providerDisplayName: string;
  contextBudgetLabel: string;
  permissionMode: PermissionMode;
  sessionManager?: CurioSessionManager;
  currentSessionId?: string;
  resumedFromSession?: string;
  memoryFile?: MemoryFileManager;
  todoManager?: TodoManager;
  planStateRef?: PlanStateRef;
  mcpBridgeManager?: McpBridgeManager;
}

export async function buildAgent(
  config: CliRuntimeConfig,
): Promise<BuildAgentResult> {
  const resolved = resolveProvider({
    model: config.model,
    provider: config.provider,
  });

  const toolsForProvider =
    resolved.providerName === "ollama" ? [] : phaseTwoTools;

  const cwd = process.cwd();

  // Session management (best-effort — tests may run without fs access to ~/.curio-code)
  let sessionManager: CurioSessionManager | undefined;
  let currentSessionId: string | undefined;
  let resumedFromSession: string | undefined;

  try {
    sessionManager = new CurioSessionManager();
    await CurioSessionManager.ensureSessionsDir();

    if (config.resumeSessionId) {
      try {
        const { session } = await sessionManager.resumeSession(config.resumeSessionId);
        currentSessionId = session.id;
        resumedFromSession = session.id;
        const time = sessionManager.formatSessionTimestamp(session);
        process.stderr.write(`[Resuming session ${session.id.slice(0, 8)} from ${time}]\n`);
      } catch {
        process.stderr.write(`Session not found: ${config.resumeSessionId}. Starting new session.\n`);
      }
    } else if (config.continueLastSession) {
      const latest = await sessionManager.findLatestForProject(cwd);
      if (latest) {
        currentSessionId = latest.id;
        resumedFromSession = latest.id;
        const time = sessionManager.formatSessionTimestamp(latest);
        process.stderr.write(`[Resuming session ${latest.id.slice(0, 8)} from ${time}]\n`);
      } else {
        process.stderr.write("[No previous session found. Starting new session.]\n");
      }
    }

    if (!currentSessionId) {
      const { session } = await sessionManager.createSession(cwd, resolved.model);
      currentSessionId = session.id;
    }
  } catch {
    // Session persistence unavailable — continue without it
    sessionManager = undefined;
  }

  // Memory system
  let memorySystem: CurioMemorySystem | undefined;
  let memoryFile: MemoryFileManager | undefined;
  let memoryPromptContent: string | undefined;

  if (config.memoryEnabled) {
    try {
      memorySystem = await buildMemorySystem(cwd);
      memoryFile = memorySystem.memoryFile;
      memoryPromptContent = await getMemoryForPrompt(memorySystem.memoryFile);
    } catch {
      process.stderr.write("Warning: Failed to initialize memory system.\n");
    }
  }

  const systemPrompt = await buildSystemPrompt({
    cwd,
    memoryContent: memoryPromptContent,
    providerName: resolved.providerName,
    modelId: resolved.modelDisplayName,
  });
  const contextWindow = buildContextWindowRuntime(resolved.model);

  const mode: PermissionMode = config.permissionMode ?? "ask";

  const warning = permissionModeStartupWarning(mode);
  if (warning) {
    process.stderr.write(`⚠ ${warning}\n`);
  }

  const { policy } = buildPermissionSystem({
    mode,
    projectRoot: cwd,
  });

  const humanInput = mode === "auto"
    ? new AutoAllowHandler()
    : new CliPermissionHandler();

  // Phase 8: Todo system
  const todoManager = new TodoManager();
  const todoTools = resolved.providerName === "ollama" ? [] : createTodoTools(todoManager);

  // Phase 8: Plan mode
  const planStateRef: PlanStateRef = { current: createPlanState() };
  const planTools = resolved.providerName === "ollama" ? [] : createPlanTools(planStateRef);

  // Phase 8: Skills
  const skillRegistry = createSkillRegistry(cwd);

  // Phase 9: MCP Integration
  let mcpBridgeManager: McpBridgeManager | undefined;
  let mcpTools: Awaited<ReturnType<McpBridgeManager["getTools"]>> = [];

  try {
    const mcpConfigs = await loadMergedMcpConfig(cwd);
    if (mcpConfigs.length > 0) {
      mcpBridgeManager = new McpBridgeManager(mcpConfigs);
      await mcpBridgeManager.startup();
      mcpTools = await mcpBridgeManager.getTools();
      if (mcpTools.length > 0) {
        process.stderr.write(`[MCP] ${mcpTools.length} tool(s) loaded from ${mcpConfigs.length} server(s)\n`);
      }
    }
  } catch {
    process.stderr.write("Warning: Failed to initialize MCP servers.\n");
  }

  const allPhase8Tools = [...todoTools, ...planTools];

  const builder = Agent.builder()
    .model(resolved.model)
    .llmClient(resolved.llmClient)
    .systemPrompt(systemPrompt)
    .tools([...toolsForProvider, ...allPhase8Tools, ...mcpTools])
    .contextManager(contextWindow.manager)
    .maxIterations(config.maxTurns ?? 100)
    .agentName("curio-code")
    .permissions(policy)
    .humanInput(humanInput);

  if (sessionManager) {
    builder.sessionManager(sessionManager.getSDKManager());
  }

  // Skip MemoryManager for Ollama — its auto-registered tools use Zod schemas
  // that Ollama's strict JSON Schema parser rejects. Memory file injection into
  // the system prompt still works; only the agent-callable memory tools are skipped.
  if (memorySystem && resolved.providerName !== "ollama") {
    builder.memoryManager(memorySystem.memoryManager);
  }

  // Phase 8: Subagent configurations
  if (resolved.providerName !== "ollama") {
    builder.subagent("explore", {
      systemPrompt: "Fast codebase exploration agent. Use read-only tools to search and understand code.",
      tools: readOnlyTools,
      model: resolved.model,
      maxIterations: 30,
    });
    builder.subagent("plan", {
      systemPrompt: "Architecture planning agent. Research and design implementation approaches before coding.",
      tools: [...readOnlyTools],
      model: resolved.model,
      maxIterations: 50,
    });
    builder.subagent("general", {
      systemPrompt: "General-purpose coding agent with full tool access.",
      tools: toolsForProvider,
      model: resolved.model,
      maxIterations: 100,
    });
  }

  // Phase 8: Register skills
  for (const skill of skillRegistry.getActiveSkills()) {
    builder.skill(skill);
  }

  const agent = builder.build();

  return {
    agent,
    model: resolved.model,
    providerName: resolved.providerName,
    modelDisplayName: resolved.modelDisplayName,
    providerDisplayName: resolved.providerDisplayName,
    contextBudgetLabel: buildContextBudgetLabel(contextWindow.config),
    permissionMode: mode,
    sessionManager,
    currentSessionId,
    resumedFromSession,
    memoryFile,
    todoManager,
    planStateRef,
    mcpBridgeManager,
  };
}
