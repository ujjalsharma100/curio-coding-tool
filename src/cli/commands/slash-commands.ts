import type { CurioSessionManager } from "../../sessions/manager.js";
import type { MemoryFileManager } from "../../memory/memory-file.js";
import {
  getModelMetadata,
  getAvailableModels,
  getAllModelAliases,
  getProviderDisplayName,
  detectAvailableProviders,
} from "../../agent/provider-config.js";
import type { TodoManager } from "../../todos/index.js";
import type { PlanStateRef } from "../../plan/plan-tools.js";
import { approvePlan, rejectPlan, exitPlanMode } from "../../plan/index.js";
import type { SubagentTaskRegistry } from "../../tools/agent-spawn.js";
import type { McpBridgeManager } from "../../mcp/index.js";
import { addMcpServerToConfig, removeMcpServerFromConfig } from "../../mcp/index.js";
import type { SkillRegistry } from "curio-agent-sdk";
import { loadConfig, getConfigValue, setConfigValue } from "../../config/index.js";
import type { CostTracker } from "../../hooks/index.js";
import { formatCostSummary } from "../../hooks/index.js";
import type { PermissionMode } from "../../permissions/modes.js";

const VERSION = "0.0.0";

export interface SlashCommandContext {
  sessionManager?: CurioSessionManager;
  memoryFile?: MemoryFileManager;
  currentSessionId?: string;
  currentModel?: string;
  currentProvider?: string;
  onCompact?: () => Promise<string>;
  todoManager?: TodoManager;
  planStateRef?: PlanStateRef;
  subagentRegistry?: SubagentTaskRegistry;
  mcpBridgeManager?: McpBridgeManager;
  skillRegistry?: SkillRegistry;
  costTracker?: CostTracker;
  permissionMode?: PermissionMode;
  onPermissionModeChange?: (mode: PermissionMode) => void;
  onExit?: () => void;
}

export interface SlashCommandResult {
  handled: boolean;
  output?: string;
  error?: string;
}

export function isSlashCommand(input: string): boolean {
  return input.startsWith("/");
}

export async function handleSlashCommand(
  input: string,
  ctx: SlashCommandContext,
): Promise<SlashCommandResult> {
  const trimmed = input.trim();
  const parts = trimmed.split(/\s+/);
  const command = parts[0]!.toLowerCase();

  switch (command) {
    case "/help":
      return handleHelp(parts.slice(1), ctx);

    case "/sessions":
      return handleListSessions(ctx);

    case "/session":
      return handleSessionSubcommand(parts.slice(1), ctx);

    case "/compact":
      return handleCompact(ctx);

    case "/memory":
      return handleMemory(ctx);

    case "/forget":
      return handleForget(parts.slice(1).join(" "), ctx);

    case "/model":
      return handleModel(parts.slice(1), ctx);

    case "/clear":
      return { handled: true, output: "__CLEAR__" };

    case "/tasks":
      return handleTasks(ctx);

    case "/task":
      return handleTask(parts.slice(1), ctx);

    case "/plan":
      return handlePlan(parts.slice(1), ctx);

    case "/mcp":
      return handleMcp(parts.slice(1), ctx);

    case "/skills":
      return handleSkills(ctx);

    case "/config":
      return handleConfig(parts.slice(1));

    case "/status":
      return handleStatus(ctx);

    case "/cost":
      return handleCost(ctx);

    case "/export":
      return handleExport(parts.slice(1), ctx);

    case "/mode":
      return handleMode(parts.slice(1), ctx);

    case "/keys":
      return handleKeys();

    case "/copy":
      return { handled: true, output: "__COPY_LAST_BLOCK__" };

    case "/bug":
      return { handled: true, output: "Report bugs at: https://github.com/curio-labs/curio-code/issues" };

    case "/version":
      return { handled: true, output: `Curio Code v${VERSION}` };

    case "/exit":
    case "/quit":
      if (ctx.onExit) {
        ctx.onExit();
      }
      return { handled: true, output: "Goodbye!" };

    default: {
      // Check skill-based slash commands
      const skillResult = handleSkillCommand(command, parts.slice(1), ctx);
      if (skillResult) return skillResult;

      return {
        handled: false,
        error: `Unknown command: ${command}. Type /help for available commands.`,
      };
    }
  }
}

const COMMAND_HELP: Record<string, { brief: string; detail: string; category: string }> = {
  "/help": {
    brief: "Show available commands and keybindings",
    detail: "Usage: /help [command]\nShow this help, or detailed help for a specific command.",
    category: "Info",
  },
  "/model": {
    brief: "Show or switch model",
    detail: "Usage: /model | /model list | /model aliases\nShow current model info, list all available models, or show short aliases.",
    category: "Model",
  },
  "/sessions": {
    brief: "List recent sessions (last 20)",
    detail: "Usage: /sessions\nShows recent sessions with ID, project, model, and timestamp.",
    category: "Session",
  },
  "/session": {
    brief: "Session management",
    detail: "Usage: /session delete <id> | /session export <id>\nDelete or export a specific session by ID (prefix match supported).",
    category: "Session",
  },
  "/compact": {
    brief: "Compress conversation context manually",
    detail: "Usage: /compact\nTriggers context window compression to free up token budget.",
    category: "Session",
  },
  "/memory": {
    brief: "Show current persistent memory",
    detail: "Usage: /memory\nDisplay the contents of MEMORY.md for this project.",
    category: "Memory",
  },
  "/forget": {
    brief: "Remove a memory",
    detail: "Usage: /forget <topic>\nRemove memory entries matching the given topic.",
    category: "Memory",
  },
  "/tasks": {
    brief: "List all tasks with status",
    detail: "Usage: /tasks\nShow all todo items and their current status.",
    category: "Tools",
  },
  "/task": {
    brief: "Show task details",
    detail: "Usage: /task <id>\nShow details for a specific task or background subagent.",
    category: "Tools",
  },
  "/plan": {
    brief: "Plan mode status and control",
    detail: "Usage: /plan | /plan approve | /plan reject | /plan cancel\nShow plan mode status or approve/reject/cancel a submitted plan.",
    category: "Tools",
  },
  "/mcp": {
    brief: "MCP server management",
    detail: "Usage: /mcp | /mcp list | /mcp add <name> <cmd> [args] | /mcp remove <name> | /mcp restart <name>\nManage Model Context Protocol server connections.",
    category: "Tools",
  },
  "/skills": {
    brief: "List available skills",
    detail: "Usage: /skills\nShow all registered skills (built-in, user, project).",
    category: "Tools",
  },
  "/config": {
    brief: "Show or modify configuration",
    detail: "Usage: /config | /config <key> | /config <key> <value>\nShow full config, get a specific key, or set a value.",
    category: "Other",
  },
  "/status": {
    brief: "Show agent status",
    detail: "Usage: /status\nShow model, provider, session, tokens used, cost, and mode info.",
    category: "Info",
  },
  "/cost": {
    brief: "Show detailed cost breakdown",
    detail: "Usage: /cost\nShow per-model, per-turn cost breakdown for this session.",
    category: "Info",
  },
  "/export": {
    brief: "Export conversation",
    detail: "Usage: /export [format]\nExport the current conversation. Formats: markdown (default), json.",
    category: "Other",
  },
  "/mode": {
    brief: "Show or change permission mode",
    detail: "Usage: /mode | /mode ask | /mode auto | /mode strict\nShow current permission mode or switch to a different one.",
    category: "Model",
  },
  "/keys": {
    brief: "Show keyboard shortcuts",
    detail: "Usage: /keys\nShow a quick-reference of all keyboard shortcuts and input prefixes.",
    category: "Info",
  },
  "/copy": {
    brief: "Copy last code block to clipboard",
    detail: "Usage: /copy\nCopies the last code block from assistant output to clipboard using OSC 52.",
    category: "Other",
  },
  "/bug": {
    brief: "Report a bug",
    detail: "Usage: /bug\nOpens link to GitHub issues for bug reporting.",
    category: "Other",
  },
  "/version": {
    brief: "Show version info",
    detail: `Usage: /version\nDisplays Curio Code version (currently v${VERSION}).`,
    category: "Info",
  },
  "/clear": {
    brief: "Clear conversation history",
    detail: "Usage: /clear\nClear the screen and conversation history (system prompt retained).",
    category: "Session",
  },
  "/exit": {
    brief: "Exit Curio Code",
    detail: "Usage: /exit or /quit\nExit the application.",
    category: "Other",
  },
};

function handleKeys(): SlashCommandResult {
  const lines = [
    "Keyboard shortcuts:",
    "",
    "  Enter              Send message",
    "  Up / Down          Navigate input history",
    "  Tab                Autocomplete /commands",
    "  Escape             Clear input / dismiss menu",
    "  Ctrl+C             Interrupt generation or shell",
    "  Ctrl+D             Exit Curio Code",
    "",
    "Input prefixes:",
    "",
    "  /command           Slash commands (type / to see menu)",
    "  !command           Run shell command directly",
    "  @path/to/file      Include file contents in context",
    "  @file:10-20        Include specific line range",
  ];
  return { handled: true, output: lines.join("\n") };
}

function handleHelp(args: string[], ctx: SlashCommandContext): SlashCommandResult {
  const sub = args[0]?.toLowerCase();

  if (sub) {
    const cmdKey = sub.startsWith("/") ? sub : `/${sub}`;
    const help = COMMAND_HELP[cmdKey];
    if (help) {
      return { handled: true, output: help.detail };
    }
    return { handled: true, error: `No help for: ${cmdKey}. Type /help for available commands.` };
  }

  const lines = ["Available commands:", ""];

  for (const [cmd, { brief }] of Object.entries(COMMAND_HELP)) {
    if (cmd === "/exit") continue;
    lines.push(`  ${cmd.padEnd(18)}— ${brief}`);
  }
  lines.push(`  /exit, /quit      — Exit Curio Code`);

  // Skill-based commands
  if (ctx.skillRegistry) {
    const skills = ctx.skillRegistry.list();
    const skillCommands = skills.filter((s) => (s as unknown as { command?: string }).command);
    if (skillCommands.length > 0) {
      lines.push("", "Skill commands:");
      for (const s of skillCommands) {
        const cmd = (s as unknown as { command?: string }).command ?? `/${s.name}`;
        lines.push(`  ${cmd.padEnd(18)}— ${s.description}`);
      }
    }
  }

  lines.push("", "Keybindings:");
  lines.push("  Enter            — Submit input");
  lines.push("  Up/Down          — Navigate history");
  lines.push("  Escape           — Clear input");
  lines.push("  Ctrl+C           — Interrupt generation");
  lines.push("  Ctrl+D           — Exit");
  lines.push("  Tab              — Autocomplete commands");

  return { handled: true, output: lines.join("\n") };
}

async function handleListSessions(
  ctx: SlashCommandContext,
): Promise<SlashCommandResult> {
  if (!ctx.sessionManager) {
    return { handled: true, error: "Session management not available." };
  }

  const sessions = await ctx.sessionManager.listSessions(20);
  if (sessions.length === 0) {
    return { handled: true, output: "No sessions found." };
  }

  const lines = ["Recent sessions:", ""];
  for (const session of sessions) {
    const time = ctx.sessionManager.formatSessionTimestamp(session);
    const proj = (session.metadata.projectPath as string) ?? "unknown";
    const model = (session.metadata.model as string) ?? "unknown";
    const shortProj = proj.split("/").slice(-2).join("/");
    lines.push(`  ${session.id.slice(0, 8)}  ${shortProj}  ${model}  ${time}`);
  }

  return { handled: true, output: lines.join("\n") };
}

async function handleSessionSubcommand(
  args: string[],
  ctx: SlashCommandContext,
): Promise<SlashCommandResult> {
  if (!ctx.sessionManager) {
    return { handled: true, error: "Session management not available." };
  }

  const subcommand = args[0]?.toLowerCase();
  const sessionId = args[1];

  if (!subcommand) {
    return {
      handled: true,
      error: "Usage: /session delete <id> | /session export <id>",
    };
  }

  if (!sessionId) {
    return { handled: true, error: `Usage: /session ${subcommand} <id>` };
  }

  const fullId = await resolveSessionId(ctx.sessionManager, sessionId);
  if (!fullId) {
    return { handled: true, error: `Session not found: ${sessionId}` };
  }

  switch (subcommand) {
    case "delete": {
      await ctx.sessionManager.deleteSession(fullId);
      return { handled: true, output: `Deleted session ${fullId.slice(0, 8)}.` };
    }
    case "export": {
      const markdown = await ctx.sessionManager.exportAsMarkdown(fullId);
      return { handled: true, output: markdown };
    }
    default:
      return { handled: true, error: `Unknown session command: ${subcommand}` };
  }
}

async function resolveSessionId(
  manager: CurioSessionManager,
  shortId: string,
): Promise<string | null> {
  const sessions = await manager.listSessions(100);
  const match = sessions.find(
    (s) => s.id === shortId || s.id.startsWith(shortId),
  );
  return match?.id ?? null;
}

async function handleCompact(
  ctx: SlashCommandContext,
): Promise<SlashCommandResult> {
  if (!ctx.onCompact) {
    return {
      handled: true,
      output: "[context compressed — older messages removed]",
    };
  }

  const result = await ctx.onCompact();
  return { handled: true, output: result };
}

async function handleMemory(
  ctx: SlashCommandContext,
): Promise<SlashCommandResult> {
  if (!ctx.memoryFile) {
    return { handled: true, error: "Memory system not available." };
  }

  const content = await ctx.memoryFile.readMainMemory();
  if (!content || content.trim().length === 0) {
    return { handled: true, output: "No memories stored yet." };
  }

  return { handled: true, output: `MEMORY.md:\n\n${content}` };
}

async function handleForget(
  topic: string,
  ctx: SlashCommandContext,
): Promise<SlashCommandResult> {
  if (!ctx.memoryFile) {
    return { handled: true, error: "Memory system not available." };
  }

  if (!topic.trim()) {
    return { handled: true, error: "Usage: /forget <topic>" };
  }

  const removed = await ctx.memoryFile.removeEntry(topic.trim());
  if (removed) {
    return { handled: true, output: `Removed memories matching "${topic.trim()}".` };
  }
  return { handled: true, output: `No memories found matching "${topic.trim()}".` };
}

// ---------------------------------------------------------------------------
// /model command — show info, list available models, show aliases
// ---------------------------------------------------------------------------

function handleModel(
  args: string[],
  ctx: SlashCommandContext,
): SlashCommandResult {
  const subcommand = args[0]?.toLowerCase();

  if (!subcommand) {
    return handleModelInfo(ctx);
  }

  switch (subcommand) {
    case "list":
      return handleModelList();
    case "aliases":
      return handleModelAliases();
    default:
      return {
        handled: true,
        error:
          `Unknown /model subcommand: ${subcommand}\n` +
          "Usage: /model | /model list | /model aliases",
      };
  }
}

function handleModelInfo(ctx: SlashCommandContext): SlashCommandResult {
  const model = ctx.currentModel;
  const provider = ctx.currentProvider;

  if (!model) {
    return { handled: true, error: "No model information available." };
  }

  const meta = getModelMetadata(model);
  const providerDisplay = provider ? getProviderDisplayName(provider) : "Unknown";

  const lines: string[] = [
    "Current model:",
    `  Model:      ${model}`,
    `  Provider:   ${providerDisplay}`,
  ];

  if (meta) {
    lines.push(
      `  Display:    ${meta.displayName}`,
      `  Context:    ${(meta.contextWindow / 1000).toFixed(0)}k tokens`,
      `  Vision:     ${meta.supportsVision ? "yes" : "no"}`,
      `  Tools:      ${meta.supportsTools ? "yes" : "no"}`,
      `  Thinking:   ${meta.supportsThinking ? "yes" : "no"}`,
    );
    if (meta.inputPricePerMToken != null) {
      lines.push(
        `  Pricing:    $${meta.inputPricePerMToken}/M input, $${meta.outputPricePerMToken}/M output`,
      );
    }
  }

  const available = detectAvailableProviders();
  if (available.length > 0) {
    lines.push("", `  Available providers: ${available.join(", ")}`);
  }

  return { handled: true, output: lines.join("\n") };
}

function handleModelList(): SlashCommandResult {
  const models = getAvailableModels();
  const available = detectAvailableProviders();

  const lines = ["Available models:", ""];

  const grouped = new Map<string, typeof models>();
  for (const m of models) {
    const list = grouped.get(m.provider) ?? [];
    list.push(m);
    grouped.set(m.provider, list);
  }

  for (const [provider, providerModels] of grouped) {
    const isAvailable = available.includes(provider);
    const status = isAvailable ? "✓" : "✗";
    lines.push(`  ${status} ${getProviderDisplayName(provider)}:`);

    for (const m of providerModels) {
      const ctx = `${(m.contextWindow / 1000).toFixed(0)}k`;
      const vision = m.supportsVision ? " 👁" : "";
      const thinking = m.supportsThinking ? " 🧠" : "";
      const price = m.inputPricePerMToken != null
        ? ` ($${m.inputPricePerMToken}/$${m.outputPricePerMToken}/M)`
        : "";
      lines.push(`    ${m.provider}:${m.id}  ${ctx}${vision}${thinking}${price}`);
    }
    lines.push("");
  }

  lines.push("Use --model <provider:model> or --model <alias> to select a model.");

  return { handled: true, output: lines.join("\n") };
}

function handleModelAliases(): SlashCommandResult {
  const aliases = getAllModelAliases();
  const lines = ["Model aliases:", ""];

  const maxLen = Math.max(...Object.keys(aliases).map((k) => k.length));
  for (const [alias, model] of Object.entries(aliases)) {
    lines.push(`  ${alias.padEnd(maxLen + 2)}→ ${model}`);
  }

  lines.push("", "Usage: curio-code --model <alias>");

  return { handled: true, output: lines.join("\n") };
}

// ---------------------------------------------------------------------------
// /tasks — list all tasks
// ---------------------------------------------------------------------------

function handleTasks(ctx: SlashCommandContext): SlashCommandResult {
  if (!ctx.todoManager) {
    return { handled: true, error: "Task system not available." };
  }
  return { handled: true, output: ctx.todoManager.summary() };
}

// ---------------------------------------------------------------------------
// /task <id> — show task details or background subagent output
// ---------------------------------------------------------------------------

function handleTask(
  args: string[],
  ctx: SlashCommandContext,
): SlashCommandResult {
  const id = args[0];
  if (!id) {
    return { handled: true, error: "Usage: /task <id>" };
  }

  if (ctx.todoManager) {
    const todo = ctx.todoManager.get(id);
    if (todo) {
      return {
        handled: true,
        output: JSON.stringify(todo, null, 2),
      };
    }
  }

  if (ctx.subagentRegistry) {
    const task = ctx.subagentRegistry.get(id);
    if (task) {
      const lines = [
        `Task: ${task.id}`,
        `Type: ${task.subagentType}`,
        `Status: ${task.status}`,
        `Description: ${task.description}`,
        `Started: ${task.startedAt}`,
      ];
      if (task.completedAt) lines.push(`Completed: ${task.completedAt}`);
      if (task.result) lines.push("", "Output:", task.result);
      if (task.error) lines.push("", `Error: ${task.error}`);
      return { handled: true, output: lines.join("\n") };
    }
  }

  return { handled: true, error: `Task not found: ${id}` };
}

// ---------------------------------------------------------------------------
// /plan — plan mode status and control
// ---------------------------------------------------------------------------

function handlePlan(
  args: string[],
  ctx: SlashCommandContext,
): SlashCommandResult {
  if (!ctx.planStateRef) {
    return { handled: true, error: "Plan mode not available." };
  }

  const sub = args[0]?.toLowerCase();
  const state = ctx.planStateRef.current;

  if (!sub) {
    const lines = [`Plan mode status: ${state.status}`];
    if (state.planContent) {
      lines.push("", "Current plan:", state.planContent);
    }
    if (state.restrictedTools.length > 0) {
      lines.push("", `Restricted tools: ${state.restrictedTools.join(", ")}`);
    }
    return { handled: true, output: lines.join("\n") };
  }

  switch (sub) {
    case "approve": {
      if (state.status !== "awaiting_approval") {
        return {
          handled: true,
          error: `Cannot approve: plan status is "${state.status}" (need "awaiting_approval").`,
        };
      }
      ctx.planStateRef.current = approvePlan(state);
      return {
        handled: true,
        output: "Plan approved. Agent now has full tool access to execute the plan.",
      };
    }
    case "reject": {
      if (state.status !== "awaiting_approval") {
        return {
          handled: true,
          error: `Cannot reject: plan status is "${state.status}" (need "awaiting_approval").`,
        };
      }
      ctx.planStateRef.current = rejectPlan(state);
      return {
        handled: true,
        output: "Plan rejected. Agent will revise (still in plan mode with read-only tools).",
      };
    }
    case "cancel": {
      ctx.planStateRef.current = exitPlanMode(state);
      return {
        handled: true,
        output: "Plan mode cancelled. Returned to normal execution.",
      };
    }
    default:
      return {
        handled: true,
        error: `Unknown /plan subcommand: ${sub}. Use: /plan | /plan approve | /plan reject | /plan cancel`,
      };
  }
}

// ---------------------------------------------------------------------------
// /mcp — MCP server management
// ---------------------------------------------------------------------------

async function handleMcp(
  args: string[],
  ctx: SlashCommandContext,
): Promise<SlashCommandResult> {
  const sub = args[0]?.toLowerCase();

  if (!sub || sub === "list") {
    return handleMcpList(ctx);
  }

  switch (sub) {
    case "add":
      return handleMcpAdd(args.slice(1));
    case "remove":
      return handleMcpRemove(args.slice(1));
    case "restart":
      return handleMcpRestart(args.slice(1), ctx);
    default:
      return {
        handled: true,
        error: `Unknown /mcp subcommand: ${sub}. Use: /mcp list | /mcp add | /mcp remove | /mcp restart`,
      };
  }
}

async function handleMcpList(
  ctx: SlashCommandContext,
): Promise<SlashCommandResult> {
  if (!ctx.mcpBridgeManager) {
    return { handled: true, output: "No MCP servers configured." };
  }

  const statuses = await ctx.mcpBridgeManager.getStatus();
  if (statuses.length === 0) {
    return { handled: true, output: "No MCP servers configured." };
  }

  const lines = ["MCP Servers:", ""];
  for (const s of statuses) {
    const icon = s.connected ? "✓" : "✗";
    lines.push(`  ${icon} ${s.name} (${s.connected ? "connected" : "disconnected"})`);
    if (s.error) {
      lines.push(`    Error: ${s.error}`);
    }
    if (s.tools.length > 0) {
      lines.push(`    Tools (${s.toolCount}): ${s.tools.join(", ")}`);
    }
  }

  return { handled: true, output: lines.join("\n") };
}

async function handleMcpAdd(
  args: string[],
): Promise<SlashCommandResult> {
  const name = args[0];
  const command = args[1];
  const restArgs = args.slice(2);

  if (!name || !command) {
    return {
      handled: true,
      error: "Usage: /mcp add <name> <command> [args...]",
    };
  }

  try {
    await addMcpServerToConfig(name, command, restArgs);
    return {
      handled: true,
      output: `Added MCP server "${name}" to .curio-code/mcp.json. Restart curio-code to connect.`,
    };
  } catch (err) {
    return {
      handled: true,
      error: `Failed to add server: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function handleMcpRemove(
  args: string[],
): Promise<SlashCommandResult> {
  const name = args[0];
  if (!name) {
    return { handled: true, error: "Usage: /mcp remove <name>" };
  }

  const removed = await removeMcpServerFromConfig(name);
  if (removed) {
    return {
      handled: true,
      output: `Removed MCP server "${name}" from .curio-code/mcp.json.`,
    };
  }
  return {
    handled: true,
    error: `MCP server "${name}" not found in project config.`,
  };
}

async function handleMcpRestart(
  args: string[],
  ctx: SlashCommandContext,
): Promise<SlashCommandResult> {
  const name = args[0];
  if (!name) {
    return { handled: true, error: "Usage: /mcp restart <name>" };
  }

  if (!ctx.mcpBridgeManager) {
    return { handled: true, error: "No MCP bridge available." };
  }

  const ok = await ctx.mcpBridgeManager.restartServer(name);
  if (ok) {
    return { handled: true, output: `Restarted MCP server "${name}".` };
  }
  return {
    handled: true,
    error: `MCP server "${name}" not found.`,
  };
}

// ---------------------------------------------------------------------------
// /skills — list available skills
// ---------------------------------------------------------------------------

function handleSkills(ctx: SlashCommandContext): SlashCommandResult {
  if (!ctx.skillRegistry) {
    return { handled: true, output: "No skills loaded." };
  }

  const skills = ctx.skillRegistry.list();
  if (skills.length === 0) {
    return { handled: true, output: "No skills registered." };
  }

  const lines = ["Available skills:", ""];
  for (const s of skills) {
    const cmd = (s as unknown as { command?: string }).command;
    const cmdStr = cmd ? ` (${cmd})` : "";
    lines.push(`  ${s.name}${cmdStr} — ${s.description}`);
  }

  return { handled: true, output: lines.join("\n") };
}

// ---------------------------------------------------------------------------
// /config — show or modify configuration
// ---------------------------------------------------------------------------

function handleConfig(args: string[]): SlashCommandResult {
  const key = args[0];
  const value = args.slice(1).join(" ");

  const loaded = loadConfig({ projectRoot: process.cwd() });

  if (!key) {
    return { handled: true, output: JSON.stringify(loaded.config, null, 2) };
  }

  if (!value) {
    const val = getConfigValue(loaded.config, key);
    if (val === undefined) {
      return { handled: true, output: `${key}: (not set)` };
    }
    return {
      handled: true,
      output: `${key}: ${typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}`,
    };
  }

  // Set value
  let parsed: unknown = value;
  if (value === "true") parsed = true;
  else if (value === "false") parsed = false;
  else if (/^\d+(\.\d+)?$/.test(value)) parsed = Number(value);

  const targetPath = loaded.projectPath ?? loaded.globalPath;
  try {
    setConfigValue(targetPath, key, parsed);
    return {
      handled: true,
      output: `Set ${key} = ${JSON.stringify(parsed)} in ${targetPath}`,
    };
  } catch (err) {
    return {
      handled: true,
      error: `Failed to set config: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// /status — show agent status
// ---------------------------------------------------------------------------

function handleStatus(ctx: SlashCommandContext): SlashCommandResult {
  const lines = ["Agent status:", ""];

  lines.push(`  Model:      ${ctx.currentModel ?? "unknown"}`);
  lines.push(`  Provider:   ${ctx.currentProvider ? getProviderDisplayName(ctx.currentProvider) : "unknown"}`);
  lines.push(`  Session:    ${ctx.currentSessionId?.slice(0, 8) ?? "none"}`);
  lines.push(`  Mode:       ${ctx.permissionMode ?? "ask"}`);

  if (ctx.costTracker) {
    lines.push(`  Turns:      ${ctx.costTracker.turns.length}`);
    lines.push(`  Est. cost:  $${ctx.costTracker.totalCost.toFixed(4)}`);
  }

  const available = detectAvailableProviders();
  if (available.length > 0) {
    lines.push(`  Providers:  ${available.join(", ")}`);
  }

  return { handled: true, output: lines.join("\n") };
}

// ---------------------------------------------------------------------------
// /cost — detailed cost breakdown
// ---------------------------------------------------------------------------

function handleCost(ctx: SlashCommandContext): SlashCommandResult {
  if (!ctx.costTracker) {
    return { handled: true, output: "Cost tracking not available." };
  }
  return { handled: true, output: formatCostSummary(ctx.costTracker) };
}

// ---------------------------------------------------------------------------
// /export — export conversation
// ---------------------------------------------------------------------------

async function handleExport(
  args: string[],
  ctx: SlashCommandContext,
): Promise<SlashCommandResult> {
  const format = args[0]?.toLowerCase() ?? "markdown";

  if (!ctx.sessionManager || !ctx.currentSessionId) {
    return { handled: true, error: "No active session to export." };
  }

  try {
    if (format === "json") {
      const data = await ctx.sessionManager.resumeSession(ctx.currentSessionId);
      return {
        handled: true,
        output: JSON.stringify({
          session: data.session,
          messages: data.messages,
        }, null, 2),
      };
    }

    const markdown = await ctx.sessionManager.exportAsMarkdown(ctx.currentSessionId);
    return { handled: true, output: markdown };
  } catch (err) {
    return {
      handled: true,
      error: `Export failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// /mode — show or change permission mode
// ---------------------------------------------------------------------------

function handleMode(
  args: string[],
  ctx: SlashCommandContext,
): SlashCommandResult {
  const newMode = args[0]?.toLowerCase();

  if (!newMode) {
    return {
      handled: true,
      output: `Current permission mode: ${ctx.permissionMode ?? "ask"}`,
    };
  }

  if (newMode !== "ask" && newMode !== "auto" && newMode !== "strict") {
    return {
      handled: true,
      error: `Invalid mode: ${newMode}. Use: ask | auto | strict`,
    };
  }

  if (ctx.onPermissionModeChange) {
    ctx.onPermissionModeChange(newMode as PermissionMode);
  }

  return {
    handled: true,
    output: `Permission mode changed to: ${newMode}`,
  };
}

// ---------------------------------------------------------------------------
// Skill-based slash commands (e.g. /commit, /pr, /review-pr, /simplify)
// ---------------------------------------------------------------------------

function handleSkillCommand(
  command: string,
  _args: string[],
  ctx: SlashCommandContext,
): SlashCommandResult | null {
  if (!ctx.skillRegistry) return null;

  const skills = ctx.skillRegistry.list();
  for (const skill of skills) {
    const skillCmd = (skill as unknown as { command?: string }).command;
    if (skillCmd && skillCmd === command) {
      const instructions = skill.instructions ?? skill.description ?? "No instructions available.";
      return {
        handled: true,
        output: `__SKILL_INVOKE__:${skill.name}:${instructions}`,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tab autocomplete support
// ---------------------------------------------------------------------------

export function getSlashCommandCompletions(partial: string): string[] {
  const allCommands = [
    ...Object.keys(COMMAND_HELP),
    "/quit",
  ];

  if (!partial.startsWith("/")) return [];

  return allCommands.filter((cmd) => cmd.startsWith(partial.toLowerCase()));
}

/**
 * Return all slash commands with metadata for the interactive command menu.
 */
export function getCommandMenuItems(): Array<{
  command: string;
  brief: string;
  category: string;
}> {
  return Object.entries(COMMAND_HELP).map(([cmd, meta]) => ({
    command: cmd,
    brief: meta.brief,
    category: meta.category,
  }));
}
