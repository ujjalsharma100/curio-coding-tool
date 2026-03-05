/**
 * File-based debug logger for the coding tool.
 * Writes structured JSONL to log files under CURIO_CODE_HOME/logs for
 * tool calls, LLM calls, agent runs, and stream events.
 */

import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getCurioHome } from "../config/index.js";

const LOG_DIR_NAME = "logs";
const DEBUG_LOG_NAME = "debug.log";
const TOOLS_LOG_NAME = "tools.log";
const LLM_LOG_NAME = "llm.log";
const RUNS_LOG_NAME = "runs.log";

/** Max length for string fields in logs (avoid huge payloads). */
const MAX_STRING_LEN = 4000;
const MAX_RESULT_LEN = 8000;

function getLogDir(): string {
  return join(getCurioHome(), LOG_DIR_NAME);
}

function ensureLogDir(): void {
  const dir = getLogDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function truncate(s: string, max = MAX_STRING_LEN): string {
  if (typeof s !== "string") return String(s);
  if (s.length <= max) return s;
  return s.slice(0, max) + `… [truncated, total ${s.length} chars]`;
}

/** Sanitize a value for logging: truncate strings, limit depth of objects. */
function sanitize(value: unknown, stringMax = MAX_STRING_LEN): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncate(value, stringMax);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: truncate(value.stack ?? "", 500) };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => sanitize(v, stringMax));
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (Object.keys(out).length >= 30) break;
      out[k] = sanitize(v, stringMax);
    }
    return out;
  }
  return value;
}

/** Build payload for debug.log (all events). */
function buildDebugPayload(
  event: string,
  ctx: { runId?: string; agentId?: string; iteration?: number; data: Record<string, unknown> },
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    ts: new Date().toISOString(),
    event,
    runId: ctx.runId ?? null,
    agentId: ctx.agentId ?? null,
    iteration: ctx.iteration ?? null,
  };

  const data = ctx.data as Record<string, unknown>;
  if (event === "tool.call.before" || event === "tool.call.after" || event === "tool.call.error") {
    base.toolName = data.toolName ?? data.tool_name ?? data.name ?? null;
    base.toolCallId = data.toolCallId ?? null;
    if (data.args !== undefined) base.args = sanitize(data.args);
    if (data.result !== undefined) base.result = truncate(String(data.result), MAX_RESULT_LEN);
    if (data.error !== undefined) base.error = sanitize(data.error, 1000);
    if (data.duration !== undefined) base.durationMs = data.duration;
  } else if (
    event === "llm.call.before" ||
    event === "llm.call.after" ||
    event === "llm.call.error"
  ) {
    const req = data.request as Record<string, unknown> | undefined;
    if (req) {
      base.model = req.model ?? null;
      base.messageCount = Array.isArray(req.messages) ? (req.messages as unknown[]).length : null;
      base.toolCount = Array.isArray(req.tools) ? (req.tools as unknown[]).length : null;
      base.maxTokens = req.maxTokens ?? null;
    }
    if (data.response !== undefined) {
      const res = data.response as Record<string, unknown>;
      base.usage = res.usage ?? null;
      base.finishReason = res.finishReason ?? null;
    }
    if (data.duration !== undefined) base.durationMs = data.duration;
    if (data.error !== undefined) base.error = sanitize(data.error, 1000);
  } else if (
    event === "agent.run.before" ||
    event === "agent.run.after" ||
    event === "agent.run.error"
  ) {
    if (data.input !== undefined) base.inputPreview = truncate(String(data.input), 500);
    if (data.result !== undefined) base.result = sanitize(data.result);
    if (data.error !== undefined) base.error = sanitize(data.error, 1000);
    if (data.iterationCount !== undefined) base.iterationCount = data.iterationCount;
  } else if (
    event === "agent.iteration.before" ||
    event === "agent.iteration.after"
  ) {
    base.iteration = data.iteration ?? ctx.iteration ?? null;
    if (data.completed !== undefined) base.completed = data.completed;
    if (data.toolCalls !== undefined) base.toolCallCount = data.toolCalls;
  } else {
    base.data = sanitize(data);
  }

  return base;
}

let logDirEnsured = false;

function ensureDirOnce(): void {
  if (!logDirEnsured) {
    ensureLogDir();
    logDirEnsured = true;
  }
}

/**
 * Append one JSONL line to a log file.
 * Files are under getCurioHome()/logs/ (e.g. debug.log, tools.log, llm.log, runs.log).
 */
export function writeLogLine(
  filename: string,
  payload: Record<string, unknown>,
): void {
  try {
    ensureDirOnce();
    const path = join(getLogDir(), filename);
    const line = JSON.stringify(payload) + "\n";
    appendFileSync(path, line, "utf-8");
  } catch {
    // Best-effort; avoid breaking the app if log dir is read-only or disk full
  }
}

/**
 * Log a single event to the main debug log (and optionally to a category-specific file).
 */
export function logEvent(
  event: string,
  ctx: { runId?: string; agentId?: string; iteration?: number; data: Record<string, unknown> },
): void {
  const payload = buildDebugPayload(event, ctx);
  writeLogLine(DEBUG_LOG_NAME, payload);

  if (event.startsWith("tool.call.")) {
    writeLogLine(TOOLS_LOG_NAME, payload);
  } else if (event.startsWith("llm.call.")) {
    writeLogLine(LLM_LOG_NAME, payload);
  } else if (event.startsWith("agent.run.") || event.startsWith("agent.iteration.")) {
    writeLogLine(RUNS_LOG_NAME, payload);
  }
}

/** Stream event types we write to the log (skip text_delta/thinking to avoid huge logs). */
const LOGGED_STREAM_TYPES = new Set([
  "tool_call_start",
  "tool_call_end",
  "iteration_start",
  "iteration_end",
  "done",
  "error",
]);

/**
 * Log a stream event from the CLI (tool_call_start/end, iteration_start/end, done, error).
 * Skips text_delta and thinking to keep log size reasonable.
 */
export function logStreamEvent(
  runId: string | undefined,
  event: Record<string, unknown> & { type: string },
): void {
  if (!LOGGED_STREAM_TYPES.has(event.type)) return;
  try {
    ensureDirOnce();
    const path = join(getLogDir(), DEBUG_LOG_NAME);
    const payload: Record<string, unknown> = {
      ts: new Date().toISOString(),
      event: "stream",
      streamEvent: event.type,
      runId: runId ?? null,
    };
    if (event.type === "tool_call_start") {
      payload.toolName = event.toolName ?? null;
      payload.toolCallId = event.toolCallId ?? null;
      payload.arguments = sanitize(event.arguments ?? event.toolInput);
    } else if (event.type === "tool_call_end") {
      payload.toolName = event.toolName ?? null;
      payload.toolCallId = event.toolCallId ?? null;
      payload.resultLength = typeof event.result === "string" ? event.result.length : 0;
      payload.resultPreview = typeof event.result === "string" ? truncate(event.result, 500) : null;
      payload.error = event.error ?? null;
      payload.durationMs = event.duration ?? null;
    } else if (event.type === "iteration_start" || event.type === "iteration_end") {
      payload.iteration = event.iteration ?? null;
    } else if (event.type === "done" && event.result) {
      const r = event.result as Record<string, unknown>;
      payload.completed = r.completed ?? null;
      payload.iterations = r.iterations ?? null;
      payload.runId = r.runId ?? runId ?? null;
    } else if (event.type === "error") {
      payload.error = sanitize(event.error, 1000);
    }
    const line = JSON.stringify(payload) + "\n";
    appendFileSync(path, line, "utf-8");
  } catch {
    // best-effort
  }
}

export function getDebugLogPath(): string {
  ensureDirOnce();
  return join(getLogDir(), DEBUG_LOG_NAME);
}

export function getLogDirPath(): string {
  ensureDirOnce();
  return getLogDir();
}
