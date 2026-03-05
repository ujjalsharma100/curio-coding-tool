import { HookRegistry, HookContext, HookEvent } from "curio-agent-sdk";
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { getCurioHome } from "../config/index.js";
import { logEvent } from "../logging/file-logger.js";

// ---------------------------------------------------------------------------
// Built-in hook: Audit log — logs all tool calls to audit.log
// ---------------------------------------------------------------------------

function createAuditHook(logPath: string): (ctx: HookContext) => void {
  const dir = dirname(logPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  return (ctx: HookContext) => {
    const timestamp = new Date().toISOString();
    const toolName = ctx.data.toolName ?? ctx.data.name ?? "unknown";
    const line = `[${timestamp}] ${ctx.event} tool=${toolName}\n`;
    try {
      appendFileSync(logPath, line, "utf-8");
    } catch {
      // Best-effort audit logging
    }
  };
}

// ---------------------------------------------------------------------------
// Built-in hook: Cost display — tracks cost per turn for /cost
// ---------------------------------------------------------------------------

export interface CostTracker {
  turns: Array<{
    model: string;
    promptTokens: number;
    completionTokens: number;
    estimatedCost: number;
  }>;
  totalCost: number;
}

function createCostHook(tracker: CostTracker): (ctx: HookContext) => void {
  return (ctx: HookContext) => {
    const usage = ctx.data.usage as
      | { promptTokens?: number; completionTokens?: number }
      | undefined;
    const model = (ctx.data.model as string) ?? "unknown";
    if (usage) {
      const promptTokens = usage.promptTokens ?? 0;
      const completionTokens = usage.completionTokens ?? 0;
      const estimated = (promptTokens * 3 + completionTokens * 15) / 1_000_000;
      tracker.turns.push({ model, promptTokens, completionTokens, estimatedCost: estimated });
      tracker.totalCost += estimated;
    }
  };
}

// ---------------------------------------------------------------------------
// Built-in hook: Safety — detect dangerous patterns in tool calls
// ---------------------------------------------------------------------------

const DANGEROUS_PATTERNS = [
  /rm\s+(-rf?|--recursive)\s+[/~]/,
  /:(){ :\|:& };:/,
  /mkfs\./,
  /dd\s+if=.*of=\/dev/,
  /chmod\s+-R\s+777\s+\//,
  />\s*\/dev\/sd/,
];

function createSafetyHook(): (ctx: HookContext) => void {
  return (ctx: HookContext) => {
    const command =
      (ctx.data.command as string) ??
      (ctx.data.input as string) ??
      "";
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        process.stderr.write(
          `\n[SAFETY WARNING] Potentially dangerous command detected: ${command.slice(0, 100)}\n`,
        );
        break;
      }
    }
  };
}

// ---------------------------------------------------------------------------
// User-configurable hooks — run shell commands on events
// ---------------------------------------------------------------------------

function createShellHook(
  event: string,
  shellCommand: string,
): (ctx: HookContext) => void {
  return (ctx: HookContext) => {
    let cmd = shellCommand;
    if (ctx.data.file_path) {
      cmd = cmd.replace(/\$\{file_path\}/g, String(ctx.data.file_path));
    }
    if (ctx.data.toolName) {
      cmd = cmd.replace(/\$\{tool_name\}/g, String(ctx.data.toolName));
    }
    try {
      execSync(cmd, { stdio: "pipe", timeout: 10_000 });
    } catch {
      process.stderr.write(`[hook] Shell command failed for ${event}: ${cmd}\n`);
    }
  };
}

// ---------------------------------------------------------------------------
// Built-in hook: Detailed debug file log (tool calls, LLM calls, agent runs)
// ---------------------------------------------------------------------------

function createDebugLogHook(): (ctx: HookContext) => void {
  return (ctx: HookContext) => {
    logEvent(ctx.event, {
      runId: ctx.runId,
      agentId: ctx.agentId,
      iteration: ctx.iteration,
      data: ctx.data,
    });
  };
}

// ---------------------------------------------------------------------------
// Build the hook system from config
// ---------------------------------------------------------------------------

export interface HookSystemResult {
  registry: HookRegistry;
  costTracker: CostTracker;
}

const DEBUG_LOG_EVENTS = [
  HookEvent.AGENT_RUN_BEFORE,
  HookEvent.AGENT_RUN_AFTER,
  HookEvent.AGENT_RUN_ERROR,
  HookEvent.AGENT_ITERATION_BEFORE,
  HookEvent.AGENT_ITERATION_AFTER,
  HookEvent.LLM_CALL_BEFORE,
  HookEvent.LLM_CALL_AFTER,
  HookEvent.LLM_CALL_ERROR,
  HookEvent.TOOL_CALL_BEFORE,
  HookEvent.TOOL_CALL_AFTER,
  HookEvent.TOOL_CALL_ERROR,
] as const;

export function buildHookSystem(hooksConfig?: Record<string, string>): HookSystemResult {
  const registry = new HookRegistry();
  const costTracker: CostTracker = { turns: [], totalCost: 0 };

  const debugLogHook = createDebugLogHook();
  for (const event of DEBUG_LOG_EVENTS) {
    registry.on(event, debugLogHook);
  }

  // Built-in: audit log
  const auditLogPath = join(getCurioHome(), "audit.log");
  registry.on("tool.call.after", createAuditHook(auditLogPath));

  // Built-in: cost tracking
  registry.on("agent.run.after", createCostHook(costTracker));

  // Built-in: safety hook on tool calls
  registry.on("tool.call.before", createSafetyHook());

  // User-configurable hooks from config
  if (hooksConfig) {
    for (const [eventKey, shellCommand] of Object.entries(hooksConfig)) {
      registry.on(eventKey, createShellHook(eventKey, shellCommand));
    }
  }

  return { registry, costTracker };
}

export function formatCostSummary(tracker: CostTracker): string {
  if (tracker.turns.length === 0) {
    return "No cost data recorded yet.";
  }

  const lines = ["Cost breakdown:", ""];

  const byModel = new Map<string, { prompt: number; completion: number; cost: number; turns: number }>();
  for (const turn of tracker.turns) {
    const existing = byModel.get(turn.model) ?? { prompt: 0, completion: 0, cost: 0, turns: 0 };
    existing.prompt += turn.promptTokens;
    existing.completion += turn.completionTokens;
    existing.cost += turn.estimatedCost;
    existing.turns += 1;
    byModel.set(turn.model, existing);
  }

  for (const [model, stats] of byModel) {
    lines.push(`  ${model}:`);
    lines.push(`    Turns: ${stats.turns}`);
    lines.push(`    Prompt tokens: ${stats.prompt.toLocaleString()}`);
    lines.push(`    Completion tokens: ${stats.completion.toLocaleString()}`);
    lines.push(`    Estimated cost: $${stats.cost.toFixed(4)}`);
    lines.push("");
  }

  lines.push(`  Total estimated cost: $${tracker.totalCost.toFixed(4)}`);
  return lines.join("\n");
}
