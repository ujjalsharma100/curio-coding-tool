import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Agent, StreamEvent } from "curio-agent-sdk";
import { getActiveTheme } from "../ui/theme.js";
import { TopBar } from "../ui/components/top-bar.js";
import { Message, type MessageRole } from "../ui/components/message.js";
import { ToolCallView } from "../ui/components/tool-call.js";
import { Input } from "../ui/components/input.js";
import { Spinner } from "../ui/components/spinner.js";
import { Notification, type NotificationItem } from "../ui/components/notification.js";
import { CommandMenu, getFilteredItems, type CommandMenuItem } from "../ui/components/command-menu.js";
import {
  isSlashCommand,
  handleSlashCommand,
  getCommandMenuItems,
  type SlashCommandContext,
} from "./commands/slash-commands.js";
import { InputHistory } from "./history.js";
import type { CurioSessionManager } from "../sessions/manager.js";
import type { MemoryFileManager } from "../memory/memory-file.js";
import { processAutoMemory } from "../memory/index.js";
import type { TodoManager } from "../todos/index.js";
import type { PlanStateRef } from "../plan/plan-tools.js";
import type { McpBridgeManager } from "../mcp/index.js";
import type { SkillRegistry } from "curio-agent-sdk";
import type { CostTracker } from "../hooks/index.js";
import type { PermissionMode } from "../permissions/modes.js";
import { logStreamEvent } from "../logging/index.js";
import { directExec, killDirectExec, detectInteractiveCommand } from "../shell/direct-exec.js";
import {
  parseFileReferences,
  resolveFileContent,
} from "../context/file-reference.js";

interface AppProps {
  readonly agent: Agent;
  readonly model: string;
  readonly providerName: string;
  readonly modelDisplayName: string;
  readonly providerDisplayName: string;
  readonly contextBudgetLabel?: string;
  readonly sessionManager?: CurioSessionManager;
  readonly currentSessionId?: string;
  readonly resumedFromSession?: string;
  readonly memoryFile?: MemoryFileManager;
  readonly memoryEnabled?: boolean;
  readonly todoManager?: TodoManager;
  readonly planStateRef?: PlanStateRef;
  readonly mcpBridgeManager?: McpBridgeManager;
  readonly skillRegistry?: SkillRegistry;
  readonly costTracker?: CostTracker;
  readonly permissionMode?: PermissionMode;
}

/* ── Unified timeline ─────────────────────────────────────────────── */

interface TLMessage { type: "message"; id: string; role: MessageRole; content: string }
interface TLToolCall {
  type: "tool_call"; id: string; name: string; argsPreview: string;
  toolArgs?: Record<string, unknown>;
  status: "running" | "completed" | "error";
  durationMs?: number; resultPreview?: string; errorMessage?: string;
}
interface TLShell {
  type: "shell_exec"; id: string; command: string;
  exitCode?: number; output: string; status: "running" | "completed";
}
type TimelineEntry = TLMessage | TLToolCall | TLShell;

let nextId = 1;
const genId = () => String(nextId++);

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg)$/i;
const COMPACT_WIDTH = 60;

function detectImagePaths(input: string): string[] {
  return input.split(/\s+/).filter((w) => IMAGE_EXTENSIONS.test(w));
}

/* ── Thinking indicator ───────────────────────────────────────────── */

function ThinkingIndicator({ theme }: { theme: ReturnType<typeof getActiveTheme> }): JSX.Element {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return <Box><Spinner theme={theme} label={`Thinking... ${elapsed}s`} /></Box>;
}

/* ── Git branch detection ─────────────────────────────────────────── */

function detectGitBranch(cwd: string): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execSync } = require("node:child_process");
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd, encoding: "utf-8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"],
    }).trim() || undefined;
  } catch { return undefined; }
}

/* ── First-launch detection ────────────────────────────────────────── */

function isFirstLaunch(): boolean {
  const sentinel = join(homedir(), ".curio-code", ".welcome-shown");
  if (existsSync(sentinel)) return false;
  try {
    mkdirSync(join(homedir(), ".curio-code"), { recursive: true });
    writeFileSync(sentinel, new Date().toISOString(), "utf-8");
  } catch { /* best effort */ }
  return true;
}

/* ── Main App ─────────────────────────────────────────────────────── */

export function App({
  agent, model, providerName, modelDisplayName, providerDisplayName,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  contextBudgetLabel,
  sessionManager, currentSessionId, resumedFromSession,
  memoryFile, memoryEnabled, todoManager, planStateRef,
  mcpBridgeManager, skillRegistry, costTracker, permissionMode,
}: AppProps): JSX.Element {
  const theme = getActiveTheme();
  const { exit } = useApp();
  const { stdout } = useStdout();

  /* ── State ──────────────────────────────────────────────────────── */

  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasFirstToken, setHasFirstToken] = useState(false);
  const [lastPromptTokens, setLastPromptTokens] = useState<number | undefined>();
  const [lastCompletionTokens, setLastCompletionTokens] = useState<number | undefined>();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const currentStreamRef = useRef<AsyncIterableIterator<StreamEvent> | null>(null);
  const interruptedRef = useRef(false);
  const inputHistoryRef = useRef(new InputHistory());
  const [persistedHistory, setPersistedHistory] = useState<string[]>([]);

  // The ID of the current assistant text entry that text_delta should append to.
  // Gets reset to null after a tool_call_start so the next text_delta creates a new entry.
  const currentTextIdRef = useRef<string | null>(null);

  // Command menu
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [cmdFilter, setCmdFilter] = useState("");
  const [cmdIndex, setCmdIndex] = useState(0);

  // Shell
  const [isRunningShell, setIsRunningShell] = useState(false);

  // First launch
  const [showWelcome] = useState(() => isFirstLaunch());

  const [currentCwd, setCurrentCwd] = useState(() => process.cwd());
  const [gitBranch, setGitBranch] = useState(() => detectGitBranch(process.cwd()));

  // Periodically refresh cwd and git branch (catches changes from bash tool calls)
  useEffect(() => {
    const id = setInterval(() => {
      const newCwd = process.cwd();
      setCurrentCwd(newCwd);
      setGitBranch(detectGitBranch(newCwd));
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Reactive terminal width — re-read on every render (Ink re-renders on SIGWINCH)
  const termWidth = stdout?.columns ?? 120;
  const isCompact = termWidth < COMPACT_WIDTH;

  const commandMenuItems = useMemo<CommandMenuItem[]>(() => getCommandMenuItems(), []);

  useEffect(() => {
    void (async () => {
      const entries = await inputHistoryRef.current.load();
      setPersistedHistory(entries);
    })();
  }, []);

  useEffect(() => {
    if (resumedFromSession) {
      setTimeline((prev) => [...prev, {
        type: "message", id: genId(), role: "assistant" as MessageRole,
        content: `[Resumed session ${resumedFromSession.slice(0, 8)}]`,
      }]);
    }
  }, [resumedFromSession]);

  /* ── Notifications ──────────────────────────────────────────────── */

  const pushNotification = useCallback((level: NotificationItem["level"], text: string) => {
    const id = genId();
    setNotifications((p) => [...p, { id, level, text }]);
    const ms = level === "error" ? 15000 : level === "warning" ? 10000 : 5000;
    setTimeout(() => setNotifications((p) => p.filter((n) => n.id !== id)), ms);
  }, []);

  /* ── Stream event handler — CORRECT timeline ordering ───────────── */
  /*
   * Key fix: after a tool_call_start, we set currentTextIdRef to null.
   * If a new text_delta arrives, we create a FRESH assistant message entry
   * at the END of the timeline (after the tool calls), so text and tool
   * calls interleave in the correct order.
   */

  const handleStreamEvent = useCallback((event: StreamEvent) => {
    const runId = event.type === "done" && event.result && "runId" in event.result
      ? (event.result as { runId: string }).runId : undefined;
    logStreamEvent(runId, event as Record<string, unknown> & { type: string });

    switch (event.type) {
      case "text_delta": {
        setHasFirstToken(true);
        const existingId = currentTextIdRef.current;
        if (existingId) {
          // Append to existing text entry
          setTimeline((prev) => prev.map((e) =>
            e.type === "message" && e.id === existingId
              ? { ...e, content: e.content + event.text } : e,
          ));
        } else {
          // Create new text entry (first text or after tool calls)
          const newId = genId();
          currentTextIdRef.current = newId;
          setTimeline((prev) => [...prev, {
            type: "message", id: newId, role: "assistant" as MessageRole, content: event.text,
          }]);
        }
        break;
      }
      case "tool_call_start": {
        setHasFirstToken(true);
        // Seal the current text entry — next text_delta will create a new one
        currentTextIdRef.current = null;
        const rawArgs = typeof event.toolInput === "string"
          ? event.toolInput : JSON.stringify(event.toolInput, null, 2);
        const parsedArgs = typeof event.toolInput === "object" && event.toolInput !== null
          ? (event.toolInput as Record<string, unknown>) : undefined;
        setTimeline((prev) => [...prev, {
          type: "tool_call", id: event.callId ?? genId(), name: event.toolName,
          argsPreview: rawArgs, toolArgs: parsedArgs, status: "running",
        }]);
        break;
      }
      case "tool_call_end": {
        const maxR = 2000;
        const preview = event.result.length > maxR ? event.result.slice(0, maxR) + "..." : event.result;
        setTimeline((prev) => prev.map((e) =>
          e.type === "tool_call" && e.id === (event.callId ?? e.id)
            ? { ...e, status: event.error ? "error" : "completed",
                durationMs: event.duration, resultPreview: preview,
                errorMessage: event.error ?? undefined } as TLToolCall
            : e,
        ));
        break;
      }
      case "thinking": {
        const tid = currentTextIdRef.current;
        if (tid) {
          setTimeline((prev) => prev.map((e) =>
            e.type === "message" && e.id === tid
              ? { ...e, content: e.content + "\n\n> " + event.text } : e,
          ));
        }
        break;
      }
      case "error": {
        pushNotification("error", event.error.message);
        currentTextIdRef.current = null;
        setTimeline((prev) => [...prev, {
          type: "message", id: genId(), role: "assistant" as MessageRole,
          content: `Error: ${event.error.message}`,
        }]);
        break;
      }
      case "done": {
        setLastPromptTokens(event.result.usage.promptTokens);
        setLastCompletionTokens(event.result.usage.completionTokens);
        break;
      }
      case "iteration_start":
      case "iteration_end":
        break;
    }
  }, [pushNotification]);

  /* ── Slash command context ──────────────────────────────────────── */

  const slashCtx: SlashCommandContext = {
    sessionManager, memoryFile, currentSessionId,
    currentModel: model, currentProvider: providerName,
    onCompact: async () => "[context compressed]",
    todoManager, planStateRef, mcpBridgeManager, skillRegistry,
    costTracker, permissionMode, onExit: () => exit(),
  };

  /* ── Shell ! execution ──────────────────────────────────────────── */

  const handleShellExec = useCallback(async (command: string) => {
    // Check for interactive commands
    const interactiveCmd = detectInteractiveCommand(command);
    if (interactiveCmd) {
      pushNotification("warning",
        `"${interactiveCmd}" requires an interactive terminal. Run it directly in your shell.`);
      return;
    }

    const shellId = genId();
    setTimeline((prev) => [...prev, {
      type: "shell_exec", id: shellId, command, output: "", status: "running",
    }]);
    setIsRunningShell(true);
    try {
      const result = await directExec(command, currentCwd, (chunk) => {
        setTimeline((prev) => prev.map((e) =>
          e.type === "shell_exec" && e.id === shellId
            ? { ...e, output: e.output + chunk } : e,
        ));
      });
      setTimeline((prev) => prev.map((e) =>
        e.type === "shell_exec" && e.id === shellId
          ? { ...e, exitCode: result.exitCode, output: result.output, status: "completed" as const } : e,
      ));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTimeline((prev) => prev.map((e) =>
        e.type === "shell_exec" && e.id === shellId
          ? { ...e, exitCode: 1, output: msg, status: "completed" as const } : e,
      ));
    } finally {
      setIsRunningShell(false);
    }
  }, [currentCwd, pushNotification]);

  /* ── Send message ───────────────────────────────────────────────── */

  const sendMessage = useCallback(async (input: string) => {
    if (!input.trim() || isStreaming || isRunningShell) return;

    // Close command menu
    setShowCommandMenu(false);

    await inputHistoryRef.current.add(input.trim());
    setPersistedHistory(inputHistoryRef.current.getEntries());

    // ! shell
    if (input.startsWith("!")) {
      const cmd = input.slice(1).trim();
      if (cmd) await handleShellExec(cmd);
      return;
    }

    // / slash commands
    if (isSlashCommand(input)) {
      const result = await handleSlashCommand(input, slashCtx);
      if (result.handled) {
        if (result.output === "__CLEAR__") { setTimeline([]); return; }
        if (result.output === "__COPY_LAST_BLOCK__") {
          // Extract last code block from assistant messages
          const assistantMsgs = timeline
            .filter((e): e is TLMessage => e.type === "message" && e.role === "assistant");
          const codeBlockRegex = /```[\s\S]*?\n([\s\S]*?)```/g;
          let lastBlock = "";
          for (const msg of assistantMsgs) {
            let match: RegExpExecArray | null;
            while ((match = codeBlockRegex.exec(msg.content)) !== null) {
              lastBlock = match[1] ?? "";
            }
          }
          if (lastBlock && stdout) {
            // OSC 52 clipboard escape sequence
            const b64 = Buffer.from(lastBlock.trim()).toString("base64");
            stdout.write(`\x1b]52;c;${b64}\x07`);
            pushNotification("info", "Copied last code block to clipboard (OSC 52).");
          } else {
            pushNotification("warning", "No code blocks found in conversation.");
          }
          return;
        }
        const content = result.error ?? result.output ?? "";
        setTimeline((prev) => [
          ...prev,
          { type: "message", id: genId(), role: "user", content: input },
          { type: "message", id: genId(), role: "assistant", content },
        ]);
        return;
      }
    }

    // Auto-memory
    if (memoryEnabled && memoryFile) {
      try {
        const saved = await processAutoMemory(input, memoryFile);
        for (const msg of saved) pushNotification("info", msg);
      } catch { /* best effort */ }
    }

    // Image detection
    const imgs = detectImagePaths(input);
    if (imgs.length) pushNotification("info", `Detected image${imgs.length > 1 ? "s" : ""}: ${imgs.join(", ")}`);

    // @file references
    const fileRefs = parseFileReferences(input, currentCwd);
    let augmented = input;
    if (fileRefs.length) {
      const contents: string[] = [];
      for (const ref of fileRefs) {
        const resolved = resolveFileContent(ref);
        contents.push(resolved.content);
        if (resolved.tokenEstimate > 2000) {
          pushNotification("warning", `${ref.relPath} (~${resolved.tokenEstimate} tokens)`);
        }
      }
      augmented = `${input}\n\n---\nReferenced files:\n\n${contents.join("\n\n")}`;
    }

    // Add user message
    setTimeline((prev) => [...prev, { type: "message", id: genId(), role: "user", content: input }]);

    // Set up initial assistant text entry
    const firstTextId = genId();
    currentTextIdRef.current = firstTextId;
    setTimeline((prev) => [...prev, { type: "message", id: firstTextId, role: "assistant", content: "" }]);

    setIsStreaming(true);
    setHasFirstToken(false);
    interruptedRef.current = false;

    const turnStart = Date.now();
    try {
      const stream = agent.astream(augmented);
      currentStreamRef.current = stream;
      for await (const event of stream) {
        if (interruptedRef.current) break;
        handleStreamEvent(event);
      }
    } catch (err) {
      if (interruptedRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      pushNotification("error", message);
      setTimeline((prev) => [...prev, {
        type: "message", id: genId(), role: "assistant",
        content: `Error: ${message}`,
      }]);
    } finally {
      setIsStreaming(false);
      setHasFirstToken(false);
      interruptedRef.current = false;
      currentStreamRef.current = null;
      currentTextIdRef.current = null;

      // Bell notification for long-running turns (>5s)
      if (Date.now() - turnStart > 5000 && stdout) {
        stdout.write("\x07");
      }

      // Refresh cwd/branch after turn (tool calls may have changed them)
      const newCwd = process.cwd();
      setCurrentCwd(newCwd);
      setGitBranch(detectGitBranch(newCwd));
    }
  }, [agent, handleStreamEvent, isStreaming, isRunningShell, pushNotification, slashCtx, memoryEnabled, memoryFile, currentCwd, handleShellExec]);

  /* ── Command menu handlers ─────────────────────────────────────── */

  const handleInputChange = useCallback((value: string) => {
    if (value.startsWith("/") && !value.includes(" ")) {
      setShowCommandMenu(true);
      setCmdFilter(value);
      setCmdIndex(0);
    } else {
      setShowCommandMenu(false);
    }
  }, []);

  const handleCmdNav = useCallback((delta: number) => {
    setCmdIndex((prev) => {
      const filtered = getFilteredItems(commandMenuItems, cmdFilter);
      const max = Math.max(0, filtered.length - 1);
      return Math.max(0, Math.min(max, prev + delta));
    });
  }, [commandMenuItems, cmdFilter]);

  const handleCmdSelect = useCallback(() => {
    const filtered = getFilteredItems(commandMenuItems, cmdFilter);
    if (filtered.length > 0) {
      const idx = Math.min(cmdIndex, filtered.length - 1);
      const cmd = filtered[idx]!.command;
      setShowCommandMenu(false);
      setCmdFilter("");
      void sendMessage(cmd);
    }
  }, [commandMenuItems, cmdFilter, cmdIndex, sendMessage]);

  const handleCmdDismiss = useCallback(() => {
    setShowCommandMenu(false);
  }, []);

  /* ── Global keys ────────────────────────────────────────────────── */

  useInput((input, key) => {
    if (key.escape && notifications.length > 0) {
      setNotifications([]);
      return;
    }
    if (key.ctrl && (input === "c" || input === "C")) {
      if (isRunningShell) {
        killDirectExec();
        pushNotification("warning", "Shell command interrupted.");
        setIsRunningShell(false);
        return;
      }
      if (isStreaming) {
        interruptedRef.current = true;
        currentStreamRef.current?.return?.(undefined);
        pushNotification("warning", "Generation interrupted.");
        setIsStreaming(false);
        setHasFirstToken(false);
      } else {
        pushNotification("info", "Use Ctrl+D to exit.");
      }
      return;
    }
    if (key.ctrl && (input === "d" || input === "D")) exit();
  }, { isActive: true });

  /* ── Render ─────────────────────────────────────────────────────── */

  const hasMessages = timeline.some((e) => e.type === "message" && e.content.trim());

  return (
    <Box flexDirection="column" width={termWidth}>
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <TopBar
        theme={theme}
        workingDirectory={currentCwd}
        gitBranch={gitBranch}
        modelDisplayName={modelDisplayName}
        providerDisplayName={providerDisplayName}
        totalPromptTokens={lastPromptTokens}
        totalCompletionTokens={lastCompletionTokens}
        termWidth={termWidth}
      />

      {/* ── Conversation timeline ───────────────────────────────── */}
      <Box flexDirection="column" flexGrow={1} marginTop={1} width={termWidth}>
        {!hasMessages && (
          <Box flexDirection="column" marginBottom={1} paddingX={1}>
            {showWelcome ? (
              <>
                <Text color={theme.accent} bold>Welcome to Curio Code!</Text>
                <Text color={theme.muted}> </Text>
                <Text color={theme.muted}>Quick start:</Text>
                <Text color={theme.dim}>  Ask questions about your codebase in natural language</Text>
                <Text color={theme.dim}>  Use <Text color={theme.accent}>@file</Text> to reference files, <Text color={theme.accent}>!cmd</Text> to run shell commands</Text>
                <Text color={theme.dim}>  Type <Text color={theme.accent}>/</Text> to see all available commands, <Text color={theme.accent}>/keys</Text> for shortcuts</Text>
                <Text color={theme.muted}> </Text>
                <Text color={theme.dim}>Try: "Explain the architecture of this project"</Text>
              </>
            ) : (
              <>
                <Text color={theme.muted}>
                  {isCompact ? 'Type a task, e.g. "explain this file"' : "What can I help you with? Try:"}
                </Text>
                {!isCompact && (
                  <>
                    <Text color={theme.dim}>  "Explain the architecture of this project"</Text>
                    <Text color={theme.dim}>  "Find and fix the bug in src/auth.ts"</Text>
                    <Text color={theme.dim}>  "Write tests for the user service"</Text>
                  </>
                )}
              </>
            )}
          </Box>
        )}

        {timeline.map((entry) => {
          switch (entry.type) {
            case "message":
              return <Message key={entry.id} id={entry.id} role={entry.role} content={entry.content} theme={theme} />;
            case "tool_call":
              return (
                <ToolCallView key={entry.id} theme={theme} name={entry.name}
                  argsPreview={entry.argsPreview} toolArgs={entry.toolArgs}
                  status={entry.status} durationMs={entry.durationMs}
                  resultPreview={entry.resultPreview} errorMessage={entry.errorMessage} />
              );
            case "shell_exec":
              return (
                <Box key={entry.id} flexDirection="column" marginBottom={1} paddingLeft={1}>
                  <Box><Text color={theme.muted}>$ </Text><Text color={theme.accent} bold>{entry.command}</Text></Box>
                  {entry.status === "running"
                    ? <Box marginLeft={2}><Spinner theme={theme} label="Running..." /></Box>
                    : <Box flexDirection="column" marginLeft={2}>
                        {entry.output && <Text wrap="wrap">{entry.output}</Text>}
                        <Text color={entry.exitCode === 0 ? theme.success : theme.danger}>
                          {entry.exitCode === 0 ? "done" : `exit ${entry.exitCode}`}
                        </Text>
                      </Box>
                  }
                </Box>
              );
          }
        })}

        {isStreaming && !hasFirstToken && <ThinkingIndicator theme={theme} />}

        {/* Tool progress indicator during streaming */}
        {isStreaming && hasFirstToken && (() => {
          const toolEntries = timeline.filter((e) => e.type === "tool_call");
          const running = toolEntries.filter((e) => e.type === "tool_call" && e.status === "running").length;
          if (running > 0) {
            const completed = toolEntries.filter((e) => e.type === "tool_call" && e.status !== "running").length;
            return (
              <Box paddingLeft={1}>
                <Spinner theme={theme} label={`Running tool ${completed + 1}/${toolEntries.length}...`} />
              </Box>
            );
          }
          return null;
        })()}
      </Box>

      {/* ── Input ───────────────────────────────────────────────── */}
      <Input
        theme={theme}
        disabled={isStreaming || isRunningShell}
        onSubmit={sendMessage}
        persistedHistory={persistedHistory}
        onChange={handleInputChange}
        termWidth={termWidth}
        commandMenuOpen={showCommandMenu}
        onCommandMenuNav={handleCmdNav}
        onCommandMenuSelect={handleCmdSelect}
        onCommandMenuDismiss={handleCmdDismiss}
      />

      {/* ── Command menu (BELOW input) ──────────────────────────── */}
      {showCommandMenu && !isStreaming && (
        <CommandMenu theme={theme} filter={cmdFilter} items={commandMenuItems}
          selectedIndex={cmdIndex} termWidth={termWidth} />
      )}

      {/* ── Notifications (BELOW everything) ────────────────────── */}
      {notifications.length > 0 && (
        <Box flexDirection="column" paddingX={1} width={termWidth}>
          {notifications.map((n) => <Notification key={n.id} item={n} theme={theme} />)}
        </Box>
      )}
    </Box>
  );
}
