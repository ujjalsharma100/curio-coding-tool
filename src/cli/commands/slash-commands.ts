import type { CurioSessionManager } from "../../sessions/manager.js";
import type { MemoryFileManager } from "../../memory/memory-file.js";

export interface SlashCommandContext {
  sessionManager?: CurioSessionManager;
  memoryFile?: MemoryFileManager;
  currentSessionId?: string;
  onCompact?: () => Promise<string>;
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
      return {
        handled: true,
        output: formatHelp(),
      };

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

    case "/clear":
      return { handled: true, output: "__CLEAR__" };

    default:
      return {
        handled: false,
        error: `Unknown command: ${command}. Type /help for available commands.`,
      };
  }
}

function formatHelp(): string {
  return [
    "Available commands:",
    "  /help              — Show this help",
    "  /sessions          — List recent sessions (last 20)",
    "  /session delete <id> — Delete a session",
    "  /session export <id> — Export session as markdown",
    "  /compact           — Manually trigger context compression",
    "  /memory            — Show current MEMORY.md contents",
    "  /forget <topic>    — Remove specific memory",
    "  /clear             — Clear the screen",
  ].join("\n");
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
